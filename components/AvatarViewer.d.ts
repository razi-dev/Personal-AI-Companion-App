import { ViewStyle, Ref } from 'react-native';

export interface AvatarViewerHandle {
  /** Play the idle/rest animation */
  playIdle(): void;
  /** Play the happy/wave/celebrate animation */
  playHappy(): void;
  /** Play the sad/cry animation */
  playSad(): void;
  /** Play any raw clip by its exact name in the GLB */
  playClip(name: string): void;
}

export interface AvatarViewerProps {
  /** Remote URL of a .glb / .gltf file (e.g. from Supabase Storage) */
  glbUrl?: string;
  /** Local asset module — use require('../../assets/model.glb') */
  localAsset?: number;
  /** Progress percentage (0-100). Drives idle/happy/sad intent when provided. */
  progress?: number;
  /** Width & height of the GL canvas in logical pixels. Default: 200 */
  size?: number;
  /** Extra style overrides for the container View */
  style?: ViewStyle;
  /**
   * Override animation clip name lookup per intent.
   * e.g. { idle: 'Armature|MyIdle', happy: 'Wave', sad: 'Cry' }
   */
  animationMap?: {
    idle?: string;
    happy?: string;
    sad?: string;
  };
  /**
   * Called after the GLB loads successfully.
   * Receives the list of all clip names and the resolved actions object.
   */
  onLoad?: (info: { clips: string[]; actions: Record<string, unknown> }) => void;
}

declare const AvatarViewer: React.ForwardRefExoticComponent<
  AvatarViewerProps & React.RefAttributes<AvatarViewerHandle>
>;

export default AvatarViewer;
