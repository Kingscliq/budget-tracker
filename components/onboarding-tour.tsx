"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, ArrowRight, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
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
    target: "payment",
    title: "Record what you spend",
    text: "Use + Add payment to record what you spend and add a note. Status shows your progress; click the Actual amount to see payment history.",
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
    [placed, setPlaced] = useState(false),
    [paymentUnavailable, setPaymentUnavailable] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const originalFocus = useRef<HTMLElement | null>(null);
  const current = steps[step];
  function finish(completed = false) {
    trackEvent(completed ? "tour_completed" : "tour_skipped");
    onFinish();
  }
  useEffect(() => {
    originalFocus.current = document.activeElement as HTMLElement;
    // Settings closes before replaying the tour; reclaim focus after its cleanup.
    const frame = requestAnimationFrame(() =>
      card.current?.focus({ preventScroll: true }),
    );
    const containFocus = (event: FocusEvent) => {
      if (card.current && !card.current.contains(event.target as Node))
        card.current.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", containFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", containFocus);
      originalFocus.current?.focus({ preventScroll: true });
    };
  }, []);
  useLayoutEffect(() => {
    const specificTarget = document.querySelector<HTMLElement>(
      `[data-tour="${current.target}"]`,
    );
    setPaymentUnavailable(current.target === "payment" && !specificTarget);
    const target =
      specificTarget ??
      document.querySelector<HTMLElement>(
        current.target === "payment"
          ? '[data-tour="expenses"]'
          : '[data-tour="settings"]',
      );
    if (!target) return;
    target.setAttribute("data-tour-active", "true");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "instant" : "smooth",
    });
    const place = () => {
      if (!card.current) return;
      const r = target.getBoundingClientRect(),
        height = card.current.offsetHeight,
        width = card.current.offsetWidth;
      const availableBottom = innerHeight - (innerWidth <= 580 ? 92 : 16);
      let top = r.bottom + 12;
      if (top + height > availableBottom) top = r.top - height - 12;
      top = Math.max(12, Math.min(top, availableBottom - height));
      const left = Math.max(12, Math.min(r.left, innerWidth - width - 12));
      setPosition((previous) =>
        previous.top === top && previous.left === left
          ? previous
          : { top, left },
      );
      setPlaced(true);
    };
    place();
    card.current?.focus({ preventScroll: true });
    // Keep the same card mounted while the target scrolls into view.
    let frame = 0;
    const schedulePlace = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const observer = new ResizeObserver(schedulePlace);
    observer.observe(target);
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", schedulePlace);
    window.addEventListener("scroll", schedulePlace, { passive: true });
    return () => {
      target.removeAttribute("data-tour-active");
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedulePlace);
      window.removeEventListener("scroll", schedulePlace);
    };
  }, [current]);
  return (
    <>
      <div className="tour-backdrop" aria-hidden="true" />
      <div
        ref={card}
        className="tour-tooltip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
        tabIndex={-1}
        style={{
          transform: `translate3d(${position.left}px, ${position.top}px, 0)`,
          visibility: placed ? "visible" : "hidden",
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            finish();
          }
          if (e.key === "Tab") {
            const buttons =
              card.current?.querySelectorAll<HTMLButtonElement>("button");
            if (!buttons?.length) return;
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === card.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
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
          onClick={() => finish()}
        >
          <X size={16} />
        </button>
        <h2 id="tour-title">{current.title}</h2>
        <p id="tour-description">
          {paymentUnavailable
            ? "When an active expense has an amount remaining, use + Add payment to record a payment. Status shows your progress; click the Actual amount to see past payments."
            : current.text}
        </p>
        <div className="tour-footer">
          <button onClick={() => finish()}>Skip tour</button>
          <div>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}>Back</button>
            )}
            <button
              className="btn btn-primary"
              onClick={() =>
                step === steps.length - 1 ? finish(true) : setStep(step + 1)
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
    </>
  );
}
