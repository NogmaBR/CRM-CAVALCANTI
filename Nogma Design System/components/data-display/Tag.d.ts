import * as React from "react";
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Show a remove (×) button that calls this handler. */
  onRemove?: () => void;
  outline?: boolean;
  children?: React.ReactNode;
}
export declare function Tag(props: TagProps): React.JSX.Element;
