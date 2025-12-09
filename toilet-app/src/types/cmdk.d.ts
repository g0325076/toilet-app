declare module 'cmdk' {
  import * as React from 'react';

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Comp = React.ComponentType<any>;

  export const Command: Comp & {
    Input: Comp;
    List: Comp;
    Empty: Comp;
    Group: Comp;
    Separator: Comp;
    Item: Comp;
  };

  export const Input: Comp;
  export const List: Comp;
  export const Empty: Comp;
  export const Group: Comp;
  export const Separator: Comp;
  export const Item: Comp;

  export default Command;
}
