import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, icon, rightElement, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-green transition-colors">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={cn(
                            "w-full bg-white border border-gray-200 text-gray-900 text-[15px] rounded-[10px] focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green block transition-all placeholder:text-gray-400",
                            icon ? "pl-10" : "pl-3",
                            rightElement ? "pr-10" : "pr-3",
                            props.size && props.size > 20 ? "py-2.5" : "py-2", // heuristic for size, better to use strict variants if needed
                            error && "border-red-500 focus:border-red-500 focus:ring-red-200",
                            className
                        )}
                        {...props}
                    />
                    {rightElement && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {rightElement}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="mt-1 text-sm text-red-500 ml-1">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
