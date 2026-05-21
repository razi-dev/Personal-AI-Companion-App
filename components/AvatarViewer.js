/**
 * AvatarViewer.js
 *
 * 3D GLB avatar viewer for Expo / React Native.
 *
 * ── Why we pre-process the GLB ────────────────────────────────────────────────
 * Three.js GLTFLoader extracts embedded textures as ArrayBuffers and wraps them
 * in `new Blob([buf], {type})` → `URL.createObjectURL(blob)`.
 * React Native's URL.createObjectURL is a native bridge call
 * (FileReaderModule.readAsDataURL) that only accepts real native Blob objects —
 * it crashes with any JS-side blob substitute.
 *
 * Solution: Before handing the file to GLTFLoader, we parse the GLB binary
 * ourselves, convert every embedded image bufferView into an inline base64
 * data URI, and re-assemble the GLB. Three.js then loads textures as plain
 * data URIs — no Blob required.
 *
 * ── gl.pixelStorei warnings ───────────────────────────────────────────────────
 * Three.js calls pixelStorei with UNPACK_FLIP_Y_WEBGL (37440) and similar
 * params that expo-gl hasn't implemented. We monkey-patch gl per-context to
 * silently skip those specific param IDs.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   const ref = useRef(null);
 *   <AvatarViewer ref={ref} localAsset={require('../../assets/model.glb')} size={220} />
 *   ref.current?.playIdle();
 *   ref.current?.playHappy();
 *   ref.current?.playSad();
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Color,
  AnimationMixer,
  Clock,
  LoopRepeat,
  SRGBColorSpace,
  ACESFilmicToneMapping,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

// ═══════════════════════════════════════════════════════════════════════════════
// GLB pre-processor
//
// Parses the GLB binary, converts every embedded image (stored as a bufferView)
// into an inline base64 data URI, and re-assembles the modified GLB so that
// Three.js can load textures without ever touching Blob / createObjectURL.
// ═══════════════════════════════════════════════════════════════════════════════

/** Convert a Uint8Array to a base64 string without hitting stack limits. */
function uint8ToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000; // 32 KB — safe for String.fromCharCode.apply
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * Reads a GLB from a local file URI, converts embedded image bufferViews to
 * data URIs, and returns a modified ArrayBuffer ready for GLTFLoader.parse().
 */
async function preprocessGLB(input) {
  let srcBuf;
  if (typeof input === 'string') {
    const bytes = await new File(input).bytes();
    srcBuf = toArrayBuffer(bytes);
  } else if (input instanceof ArrayBuffer) {
    srcBuf = input;
  } else if (ArrayBuffer.isView(input)) {
    srcBuf = toArrayBuffer(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
  } else {
    throw new Error('Unsupported GLB input.');
  }
  const dv = new DataView(srcBuf);

  // Validate GLB magic (0x46546C67 = 'glTF' LE)
  if (dv.getUint32(0, true) !== 0x46546C67) {
    // Not a GLB — return as-is (might be glTF JSON)
    return srcBuf;
  }

  // ── Parse chunks ──────────────────────────────────────────────────────────
  let jsonStr = null;
  let binStart = 0;   // byte offset of BIN chunk DATA inside srcBuf
  let binLen   = 0;

  let offset = 12; // skip 12-byte GLB header
  while (offset < srcBuf.byteLength) {
    const chunkLen  = dv.getUint32(offset,     true);
    const chunkType = dv.getUint32(offset + 4, true);

    if (chunkType === 0x4E4F534A) {         // 0x4E4F534A = 'JSON'
      jsonStr = new TextDecoder().decode(new Uint8Array(srcBuf, offset + 8, chunkLen));
    } else if (chunkType === 0x004E4942) {  // 0x004E4942 = 'BIN\0'
      binStart = offset + 8;
      binLen   = chunkLen;
    }

    offset += 8 + chunkLen;
  }

  if (!jsonStr) return srcBuf; // malformed GLB — pass through

  // ── Patch JSON: embed images as data URIs ─────────────────────────────────
  const gltf = JSON.parse(jsonStr);

  if (Array.isArray(gltf.images) && binLen > 0) {
    for (const img of gltf.images) {
      if (img.bufferView === undefined) continue; // already a URI — skip

      const bv    = gltf.bufferViews[img.bufferView];
      const start = binStart + (bv.byteOffset || 0);
      const imgBytes = new Uint8Array(srcBuf, start, bv.byteLength);
      const mime     = img.mimeType || 'image/png';

      img.uri = `data:${mime};base64,${uint8ToBase64(imgBytes)}`;
      delete img.bufferView; // remove reference — Three.js will use img.uri
    }
  }

  // ── Re-assemble GLB ───────────────────────────────────────────────────────
  const newJsonRaw  = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPadLen  = Math.ceil(newJsonRaw.length / 4) * 4; // 4-byte aligned
  const hasBin      = binLen > 0;
  const binPadLen   = hasBin ? Math.ceil(binLen / 4) * 4 : 0;

  const totalLen = 12                         // GLB header
                 + 8 + jsonPadLen             // JSON chunk header + data
                 + (hasBin ? 8 + binPadLen : 0); // BIN chunk header + data

  const outBuf = new ArrayBuffer(totalLen);
  const outDv  = new DataView(outBuf);
  const outU8  = new Uint8Array(outBuf);

  // GLB header
  outDv.setUint32(0, 0x46546C67, true); // magic
  outDv.setUint32(4, 2,           true); // version
  outDv.setUint32(8, totalLen,    true); // total length

  // JSON chunk
  outDv.setUint32(12, jsonPadLen,   true); // chunk length
  outDv.setUint32(16, 0x4E4F534A, true); // chunk type JSON
  outU8.set(newJsonRaw, 20);
  outU8.fill(0x20, 20 + newJsonRaw.length, 20 + jsonPadLen); // pad with spaces

  // BIN chunk
  if (hasBin) {
    const binChunkOffset = 12 + 8 + jsonPadLen;
    outDv.setUint32(binChunkOffset,     binPadLen,   true); // chunk length
    outDv.setUint32(binChunkOffset + 4, 0x004E4942, true); // chunk type BIN
    outU8.set(new Uint8Array(srcBuf, binStart, binLen), binChunkOffset + 8);
    outU8.fill(0x00, binChunkOffset + 8 + binLen, binChunkOffset + 8 + binPadLen);
  }

  return outBuf;
}

/** Fetch a remote GLB URL as ArrayBuffer and pre-process it. */
async function preprocessGLBRemote(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const buf = await response.arrayBuffer();

  return preprocessGLB(buf);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function resolveLocalAsset(assetModule) {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  return asset.localUri;
}

const DEFAULT_ANIMATION_MAP = {
  idle:  ['idle', 'rest', 'breathing', 'standing', 'neutral', 'default', 'bind'],
  happy: ['happy', 'wave', 'clap', 'cheer', 'joy', 'dance', 'celebrate'],
  sad:   ['sad',   'cry',  'dejected',  'depressed',  'upset', 'defeated'],
};

function findClipName(names, patterns) {
  for (const p of patterns) {
    const m = names.find((n) => n.toLowerCase().includes(p.toLowerCase()));
    if (m) return m;
  }
  return null;
}

const FADE_DURATION = 0.4;
const LOAD_TIMEOUT_MS = 20000;

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════
const AvatarViewer = forwardRef(function AvatarViewer(
  { glbUrl, localAsset, size = 200, style, animationMap, onLoad },
  ref
) {
  const animFrameRef     = useRef(null);
  const mixerRef         = useRef(null);
  const actionsRef       = useRef({});
  const currentActionRef = useRef(null);

  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState(null);
  const [status,  setStatus]  = React.useState('Waiting for GL context...');

  // ── Exposed imperative API ─────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    playIdle:  () => _play('idle'),
    playHappy: () => _play('happy'),
    playSad:   () => _play('sad'),
    playClip:  (name) => {
      const a = actionsRef.current.__raw__?.[name];
      if (a) _crossFade(a);
      else console.warn('[AvatarViewer] Clip not found:', name);
    },
  }), []);

  function _play(intent) {
    const a = actionsRef.current[intent];
    if (!a) {
      const have = Object.keys(actionsRef.current).filter((k) => k !== '__raw__');
      console.warn(`[AvatarViewer] No clip for intent "${intent}". Have:`, have);
      return;
    }
    _crossFade(a);
  }

  function _crossFade(next) {
    const cur = currentActionRef.current;
    if (cur === next) return;
    next.reset();
    next.setLoop(LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    if (cur) next.crossFadeFrom(cur, FADE_DURATION, true).play();
    else     next.fadeIn(FADE_DURATION).play();
    currentActionRef.current = next;
  }

  // ── GL context ─────────────────────────────────────────────────────────────
  const onContextCreate = useCallback(async (gl) => {
    const startMs = Date.now();
    const mark = (label) =>
      console.log(`[AvatarViewer] ${label} (+${Date.now() - startMs}ms)`);

    setLoading(true);
    setError(null);
    setStatus('GL context ready. Preparing model...');

    if (!gl || typeof gl !== 'object') {
      setError('GL context not available. Disable Remote Debugging and try a real device.');
      setLoading(false);
      return;
    }

    // Fix 1: Silence unsupported pixelStorei params from Three.js
    const _origPS = gl.pixelStorei.bind(gl);
    gl.pixelStorei = (pname, param) => {
      // 37440 = UNPACK_FLIP_Y_WEBGL
      // 37441 = UNPACK_PREMULTIPLY_ALPHA_WEBGL
      // 37443 = UNPACK_COLORSPACE_CONVERSION_WEBGL
      if (pname === 37440 || pname === 37441 || pname === 37443) return;
      _origPS(pname, param);
    };

    mark('GL context created');

    // Resolve + pre-process GLB (Fix 2: embed textures as data URIs)
    let glbBuffer;
    try {
      setStatus('Resolving model asset...');
      if (localAsset) {
        const uri = await resolveLocalAsset(localAsset);
        mark('Local asset resolved');
        setStatus('Pre-processing GLB...');
        glbBuffer = await preprocessGLB(uri);
      } else if (glbUrl) {
        setStatus('Downloading GLB...');
        glbBuffer = await preprocessGLBRemote(glbUrl);
      } else {
        throw new Error('Provide glbUrl or localAsset prop.');
      }
      mark('GLB pre-processed');
    } catch (e) {
      console.error('[AvatarViewer] Pre-processing failed:', e);
      setError('Could not load model: ' + e.message);
      setLoading(false);
      return;
    }

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(new Color(0x0a0a1a), 1);
    renderer.physicallyCorrectLights = true;

    if ('outputColorSpace' in renderer) {
      renderer.outputColorSpace = SRGBColorSpace;
    } else {
      renderer.outputEncoding = 3001; // THREE.sRGBEncoding (legacy)
    }
    renderer.toneMapping         = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new Scene();

    // ── 5-light rig ───────────────────────────────────────────────────────────
    scene.add(new HemisphereLight(0xfff4e0, 0x2a2a5a, 1.2));

    const keyLight = new DirectionalLight(0xfff8f0, 3.5);
    keyLight.position.set(1.5, 3, 3);
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0xd0e8ff, 1.5);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);

    const rimLight = new DirectionalLight(0x7c9eff, 2.0);
    rimLight.position.set(-1, 1.5, -3);
    scene.add(rimLight);

    const bounceLight = new DirectionalLight(0xffd080, 0.6);
    bounceLight.position.set(0, -2, 1);
    scene.add(bounceLight);

    // ── Camera ────────────────────────────────────────────────────────────────
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const camera = new PerspectiveCamera(35, aspect, 0.01, 100);
    camera.position.set(0, 1.55, 2.2);
    camera.lookAt(0, 1.55, 0);

    // ── Parse GLB ─────────────────────────────────────────────────────────────
    const loader = new GLTFLoader();
    setStatus('Parsing GLB...');

    loader.parse(
      glbBuffer,
      '',
      (gltf) => {
        const avatar = gltf.scene;

        avatar.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow    = false;
          child.receiveShadow = false;
          child.frustumCulled = true;
        });

        scene.add(avatar);

        // ── AnimationMixer ──────────────────────────────────────────────────
        const mixer     = new AnimationMixer(avatar);
        mixerRef.current = mixer;

        const clips     = gltf.animations || [];
        const clipNames = clips.map((c) => c.name);
        console.log('[AvatarViewer] Available clips:', clipNames);

        const nameMap = {
          idle:  [...(animationMap?.idle  ? [animationMap.idle]  : []), ...DEFAULT_ANIMATION_MAP.idle],
          happy: [...(animationMap?.happy ? [animationMap.happy] : []), ...DEFAULT_ANIMATION_MAP.happy],
          sad:   [...(animationMap?.sad   ? [animationMap.sad]   : []), ...DEFAULT_ANIMATION_MAP.sad],
        };

        const actions = {};
        for (const [intent, patterns] of Object.entries(nameMap)) {
          const matched = findClipName(clipNames, patterns);
          if (matched) {
            actions[intent] = mixer.clipAction(clips.find((c) => c.name === matched));
            console.log(`[AvatarViewer] "${intent}" → "${matched}"`);
          } else {
            console.warn(`[AvatarViewer] No clip for "${intent}"`, patterns);
          }
        }

        // Raw access map
        const rawActions = {};
        clips.forEach((c) => { rawActions[c.name] = mixer.clipAction(c); });
        actions.__raw__ = rawActions;

        actionsRef.current = actions;
        onLoad?.({ clips: clipNames, actions });

        // Auto-play idle (or first clip)
        if (actions.idle) {
          _crossFade(actions.idle);
        } else if (clips.length > 0) {
          console.warn('[AvatarViewer] No idle clip — playing first clip as fallback.');
          _crossFade(mixer.clipAction(clips[0]));
        }

        mark('GLTF parsed');
        setStatus('');
        setLoading(false);

        // ── Render loop ───────────────────────────────────────────────────────
        const clock = new Clock();
        const render = () => {
          animFrameRef.current = requestAnimationFrame(render);
          mixer.update(clock.getDelta());
          renderer.render(scene, camera);
          gl.endFrameEXP();
        };
        render();
      },
      (err) => {
        console.error('[AvatarViewer] GLTFLoader.parse error:', err);
        setError('Failed to parse model.');
        setLoading(false);
      }
    );
  }, [glbUrl, localAsset]);

  // Timeout guard: if we never get a usable GL context or parsing hangs.
  useEffect(() => {
    if (!loading || error) return undefined;
    const t = setTimeout(() => {
      if (loading && !error) {
        setError('Avatar load timed out. Disable Remote Debugging and try a real device.');
        setLoading(false);
      }
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading, error]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      mixerRef.current?.stopAllAction();
    };
  }, []);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#7c9eff" />
          {status ? <Text style={styles.statusText}>{status}</Text> : null}
        </View>
      )}
      {error && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
});

export default AvatarViewer;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#0a0a1a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,26,0.75)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  statusText: {
    color: '#8a9cc8',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: 10,
  },
});


