import { invoke } from '@tauri-apps/api/core';
import { writeFile, readTextFile } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';
import { v4 as uuidv4 } from 'uuid';
import type { Project, Track } from '../types/project';

export class ProjectService {
  async saveProject(project: Project, recordingBlobs: Map<string, Blob>): Promise<string | null> {
    const filePath = await save({
      filters: [{ name: 'Aboboo Project', extensions: ['aboboo'] }],
      defaultPath: `${project.name}.aboboo`,
    });
    if (!filePath) return null;

    const appDataDir: string = await invoke('get_app_data_dir');
    const recordingsDir = `${appDataDir}/recordings/${project.id}`;

    const updatedTracks: Track[] = [];
    for (const track of project.tracks) {
      if (track.type === 'recording') {
        const blob = recordingBlobs.get(track.id);
        if (blob) {
          const fileName = `${track.id}.webm`;
          const arrayBuffer = await blob.arrayBuffer();
          await writeFile(`${recordingsDir}/${fileName}`, new Uint8Array(arrayBuffer));
          updatedTracks.push({ ...track, audioPath: `recordings/${project.id}/${fileName}` });
        } else {
          updatedTracks.push(track);
        }
      } else {
        updatedTracks.push(track);
      }
    }

    const updatedProject: Project = {
      ...project,
      tracks: updatedTracks,
      metadata: { ...project.metadata, updatedAt: new Date().toISOString() },
    };

    const json = JSON.stringify(updatedProject, null, 2);
    const encoder = new TextEncoder();
    await writeFile(filePath, encoder.encode(json));
    return filePath;
  }

  async loadProject(): Promise<{ project: Project; blobUrls: Map<string, string> } | null> {
    const filePath = await open({
      filters: [{ name: 'Aboboo Project', extensions: ['aboboo'] }],
      multiple: false,
    });
    if (!filePath || typeof filePath !== 'string') return null;

    const json = await readTextFile(filePath);
    const project: Project = JSON.parse(json);

    const appDataDir: string = await invoke('get_app_data_dir');
    const blobUrls = new Map<string, string>();

    for (const track of project.tracks) {
      if (track.audioPath) {
        const fullPath = track.type === 'original'
          ? track.audioPath
          : `${appDataDir}/${track.audioPath}`;
        blobUrls.set(track.id, `asset://${fullPath}`);
      }
    }

    return { project, blobUrls };
  }

  createProject(name: string, originalAudioPath: string, duration: number): Project {
    const now = new Date().toISOString();
    const projectId = uuidv4();
    const trackId = uuidv4();
    return {
      id: projectId,
      name,
      originalAudioPath,
      duration,
      tracks: [
        {
          id: trackId,
          type: 'original',
          name: 'Original',
          audioPath: originalAudioPath,
          startTime: 0,
          duration,
          volume: 1,
          muted: false,
        },
      ],
      metadata: { createdAt: now, updatedAt: now },
    };
  }
}

export const projectService = new ProjectService();
