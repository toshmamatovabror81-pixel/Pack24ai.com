import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'link';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-[10px]";

        const variants = {
            primary: "bg-brand-green text-white hover:bg-[#053d2e] focus:ring-brand-green shadow-sm",
            secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-200 shadow-sm",
            danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500",
            ghost: "hover:bg-gray-100 text-gray-600",
            outline: "border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700",
            link: "text-blue-600 hover:underline bg-transparent"
        };

        const sizes = {
            sm: "h-8 px-3 text-sm",
            md: "h-10 px-4 text-[15px]",
            lg: "h-12 px-6 text-base",
            icon: "h-10 w-10 p-2"
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
