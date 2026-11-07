"use client";
import { useState } from "react";
import { ArrowRight, Play, Wallet } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";

const VIDEO_URL = "https://www.loom.com/share/17e024ceec7f43f09f893f667cd6afbb";
const EMBED_URL =
  "https://www.loom.com/embed/17e024ceec7f43f09f893f667cd6afbb?autoplay=1";
export const WELCOME_VIDEO_STORAGE = "pocket-welcome-video-v1";

export function WelcomeVideo({
  onClose,
  onTour,
}: {
  onClose: () => void;
  onTour: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="welcome-video-dialog"
      title="A little clarity for your money"
      description="See how Pocket works, or take a quick tour at your own pace."
    >
      <div className="welcome-video-player">
        {playing ? (
          <iframe
            src={EMBED_URL}
            title="How to use Pocket — video walkthrough"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        ) : (
          <button
            className="welcome-video-preview"
            onClick={() => setPlaying(true)}
          >
            <span className="welcome-video-mark" aria-hidden="true">
              <Wallet size={24} /> pocket.
            </span>
            <span className="welcome-video-play">
              <Play size={24} fill="currentColor" aria-hidden="true" />
            </span>
            <strong>See Pocket in action</strong>
            <span>Watch the video walkthrough</span>
          </button>
        )}
      </div>
      {playing && (
        <a
          className="welcome-video-external"
          href={VIDEO_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Having trouble playing? Watch on Loom{" "}
          <ArrowRight size={13} aria-hidden="true" />
        </a>
      )}
      <div className="welcome-video-actions">
        <Button variant="outline" onClick={onTour}>
          Take the quick tour <ArrowRight size={14} aria-hidden="true" />
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
      </div>
      <p className="welcome-video-hint">
        You can watch this again anytime in Settings.
      </p>
    </Dialog>
  );
}
