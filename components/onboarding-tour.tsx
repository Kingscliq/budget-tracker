"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, ArrowRight, Check } from "lucide-react";
const steps = [
  {
    target: "income",
    title: "Start with your income",
    text: "Choose a salary scenario or enter your own amount. Your plan updates straight away.",
  },
  {
    target: "expenses",
    title: "Plan it. Then track it.",
    text: "Add or edit an expense, then record payments as you go. Cancel an item to free its unpaid amount.",
  },
  {
    target: "savings",
    title: "Make room for future you",
    text: "Savings are part of your monthly expenses. Set a target here and record contributions in your main budget.",
  },
  {
    target: "settings",
    title: "Your budget, your choice",
    text: "Everything saves on this device. Settings has backups and optional sync when you want to use another device.",
  },
];
export function OnboardingTour({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0),
    [position, setPosition] = useState({ top: 90, left: 16 }),
    [placed, setPlaced] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const originalFocus = useRef<HTMLElement | null>(null);
  const current = steps[step];
  useEffect(() => {
    originalFocus.current = document.activeElement as HTMLElement;
    return () => originalFocus.current?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-tour="${current.target}"]`,
    );
    if (!target) return;
    target.setAttribute("data-tour-active", "true");
    target.scrollIntoView({ block: "center", behavior: "instant" });
    const place = () => {
      if (!card.current) return;
      const r = target.getBoundingClientRect(),
        height = card.current.offsetHeight,
        width = card.current.offsetWidth;
      const availableBottom = innerHeight - (innerWidth <= 580 ? 92 : 16);
      let top = r.bottom + 12;
      if (top + height > availableBottom) top = r.top - height - 12;
      top = Math.max(12, Math.min(top, availableBottom - height));
      setPosition({
        top,
        left: Math.max(12, Math.min(r.left, innerWidth - width - 12)),
      });
      setPlaced(true);
    };
    place();
    card.current?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      target.removeAttribute("data-tour-active");
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [current]);
  return (
    <div
      ref={card}
      className="tour-tooltip"
      role="dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
      tabIndex={-1}
      style={{ ...position, visibility: placed ? "visible" : "hidden" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onFinish();
        }
      }}
    >
      <div className="tour-kicker">
        A QUICK LOOK AROUND{" "}
        <span>
          {step + 1} / {steps.length}
        </span>
      </div>
      <button
        className="icon-button tour-close"
        aria-label="Skip tour"
        onClick={onFinish}
      >
        <X size={16} />
      </button>
      <h2 id="tour-title">{current.title}</h2>
      <p id="tour-description">{current.text}</p>
      <div className="tour-footer">
        <button onClick={onFinish}>Skip tour</button>
        <div>
          {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
          <button
            className="btn btn-primary"
            onClick={() =>
              step === steps.length - 1 ? onFinish() : setStep(step + 1)
            }
          >
            {step === steps.length - 1 ? "Got it" : "Next"}
            {step === steps.length - 1 ? (
              <Check size={14} />
            ) : (
              <ArrowRight size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
