import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'danger' | 'signal';
  size?: 'sm' | 'md' | 'icon';
  asChild?: boolean;
}

const variants: Record<string, string> = {
  default: 'bg-ink text-paper hover:bg-ink/90',
  ghost: 'bg-transparent text-ink hover:bg-cream',
  outline: 'border border-line bg-transparent text-ink hover:bg-cream',
  danger: 'bg-danger text-white hover:bg-danger/90',
  signal: 'bg-signal text-white hover:bg-signal/90',
};
const sizes: Record<string, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  icon: 'h-8 w-8',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
