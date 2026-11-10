// Every scrolling screen and sheet: drag the content down to put the keyboard away, and a tap on a button works
// even while the keyboard is up (a tap on empty space puts it away). Screens can still set their own.
import { forwardRef, type ComponentProps, type ComponentRef } from 'react';
import { ScrollView as RNScrollView } from '@real/react-native';

export const ScrollView = forwardRef<ComponentRef<typeof RNScrollView>, ComponentProps<typeof RNScrollView>>(function ScrollView(props, ref) {
  return <RNScrollView keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" {...props} ref={ref} />;
});
