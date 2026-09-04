import * as React from "react";
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  /** Full name — used for initials fallback and title. */
  name?: string;
  size?: AvatarSize;
  /** Rounded-square instead of circle. */
  square?: boolean;
  status?: "online" | "away" | "offline";
}
export declare function Avatar(props: AvatarProps): React.JSX.Element;
