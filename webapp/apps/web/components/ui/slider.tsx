'use client';
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

// A single-or-range slider over one track. value is number[] (1 or 2 thumbs).
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root ref={ref} className={cn('relative flex h-5 w-full touch-none select-none items-center', className)} {...props}>
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-cream">
      <SliderPrimitive.Range className="absolute h-full bg-accent" />
    </SliderPrimitive.Track>
    {(props.value ?? props.defaultValue ?? [0]).map((_: number, i: number) => (
      <SliderPrimitive.Thumb
        key={i}
        className="block h-4 w-4 cursor-grab rounded-full border-2 border-accent bg-paper shadow transition-transform focus:outline-none focus:ring-2 focus:ring-accent/40 active:cursor-grabbing"
        aria-label={props['aria-label'] ?? `thumb-${i}`}
      />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';
