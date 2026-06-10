"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  titleClassName?: string;
}

function DisplayCard({
  className,
  icon = <Sparkles className="size-4 text-primary" aria-hidden />,
  title = "Featured",
  description = "Discover amazing content",
  date = "Just now",
  titleClassName = "text-primary",
}: DisplayCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-36 w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border border-border bg-card/70 px-4 py-3 backdrop-blur-sm transition-all duration-700 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[20rem] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[''] hover:border-primary/30 hover:bg-card [&>*]:flex [&>*]:items-center [&>*]:gap-2",
        className,
      )}
    >
      <div>
        <span className="relative inline-block rounded-full border border-primary/25 bg-primary/15 p-1.5">
          {icon}
        </span>
        <p className={cn("text-base font-semibold font-display", titleClassName)}>{title}</p>
      </div>
      <p className="whitespace-nowrap font-mono text-sm text-foreground/90">{description}</p>
      <p className="font-mono text-xs text-muted-foreground">{date}</p>
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
}

/**
 * Fanned stack of three cards sharing one grid cell: the back cards sit
 * desaturated under a wash that lifts on hover, the front card rides above.
 * Adapted from 21st.dev display-cards onto the Claudelance token set.
 */
export default function DisplayCards({ cards }: DisplayCardsProps) {
  const stackWash =
    "before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-xl before:outline-1 before:outline-border before:content-[''] before:bg-background/50 before:transition-opacity before:duration-700 grayscale-[100%] hover:grayscale-0 hover:before:opacity-0";

  const defaultCards: DisplayCardProps[] = [
    { className: cn("[grid-area:stack] hover:-translate-y-10", stackWash) },
    { className: cn("[grid-area:stack] translate-x-12 translate-y-10 hover:-translate-y-1", stackWash) },
    { className: "[grid-area:stack] translate-x-24 translate-y-20 hover:translate-y-10" },
  ];

  const displayCards = cards?.map((card, i) => ({
    ...defaultCards[i],
    ...card,
    className: cn(defaultCards[i]?.className, card.className),
  })) ?? defaultCards;

  return (
    <div className="grid place-items-center opacity-100 [grid-template-areas:'stack']">
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}
