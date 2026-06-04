import fs from "node:fs";
import type { Page } from "@playwright/test";

/**
 * Records the current browser tab (video + audio) via getDisplayMedia.
 * Playwright's recordVideo is video-only; this is required for SFX/music.
 * Requires headed Chromium with tab-capture flags (see marketing video spec).
 */
export async function startTabVideoRecording(page: Page): Promise<void> {
  await page.exposeFunction("pwSaveTabVideo", (base64: string) => {
    (page as Page & { __tabVideoB64?: string }).__tabVideoB64 = base64;
  });

  const started = await page.evaluate(async () => {
    const w = window as unknown as {
      __tabRecorderActive?: boolean;
      __tabRecorderChunks?: BlobPart[];
      __tabRecorder?: MediaRecorder;
      __tabStream?: MediaStream;
    };
    if (w.__tabRecorderActive) return true;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as MediaStreamConstraints);

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      w.__tabRecorderChunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) w.__tabRecorderChunks!.push(e.data);
      };
      recorder.start(400);
      w.__tabRecorder = recorder;
      w.__tabStream = stream;
      w.__tabRecorderActive = true;
      return true;
    } catch (err) {
      console.warn("[tab-video] getDisplayMedia failed:", err);
      return false;
    }
  });

  if (!started) {
    throw new Error(
      "Tab recording did not start. Run with CAPTURE_HEADED=1 (headed Chromium) so tab audio can be captured.",
    );
  }
}

export async function stopTabVideoRecording(page: Page, destPath: string): Promise<boolean> {
  const tagged = page as Page & { __tabVideoB64?: string };
  tagged.__tabVideoB64 = undefined;

  const saved = await page.evaluate(async () => {
    const w = window as unknown as {
      __tabRecorder?: MediaRecorder;
      __tabStream?: MediaStream;
      __tabRecorderChunks?: BlobPart[];
      __tabRecorderActive?: boolean;
    };
    const recorder = w.__tabRecorder;
    if (!recorder) return false;

    return new Promise<boolean>((resolve) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(w.__tabRecorderChunks ?? [], { type: recorder.mimeType });
          w.__tabStream?.getTracks().forEach((t) => t.stop());
          w.__tabRecorderActive = false;
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
          await (window as unknown as { pwSaveTabVideo: (b: string) => void }).pwSaveTabVideo(
            btoa(binary),
          );
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      recorder.stop();
    });
  });

  if (!saved || !tagged.__tabVideoB64) return false;
  fs.writeFileSync(destPath, Buffer.from(tagged.__tabVideoB64, "base64"));
  return true;
}
