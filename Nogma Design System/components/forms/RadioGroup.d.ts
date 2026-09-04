import * as React from "react";
export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}
export interface RadioGroupProps {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: RadioOption[];
  className?: string;
}
export declare function RadioGroup(props: RadioGroupProps): React.JSX.Element;
