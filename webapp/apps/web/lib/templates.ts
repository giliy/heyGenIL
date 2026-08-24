// Web-side launch-template catalog. The canonical data (compositionId + defaultSpec)
// lives in @shorts/spec (LAUNCH_TEMPLATES); this module adds the poster storage key.
import { LAUNCH_TEMPLATES, type LaunchTemplate, type SpecMode } from '@shorts/spec';

export interface TemplateCard {
  id: string;
  title: string;
  compositionId: string;
  /** Content track the template belongs to (tsx|ad|kids|ai|vox). */
  engine: SpecMode;
  /** Storage key for the pre-rendered frame-0 poster (served at /media/<key>). */
  posterKey: string;
  posterUrl: string;
}

export function templatePosterKey(templateId: string): string {
  return `templates/${templateId}/poster.jpg`;
}

export function listTemplateCards(): TemplateCard[] {
  return LAUNCH_TEMPLATES.map((t: LaunchTemplate) => {
    const key = templatePosterKey(t.id);
    return {
      id: t.id,
      title: t.title,
      compositionId: t.compositionId,
      engine: t.mode ?? t.engine,
      posterKey: key,
      posterUrl: `/media/${key}`,
    };
  });
}

export function getTemplateById(templateId: string): LaunchTemplate | undefined {
  return LAUNCH_TEMPLATES.find((t) => t.id === templateId);
}
