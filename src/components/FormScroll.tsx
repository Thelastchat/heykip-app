// A scrolling page or sheet with text boxes. When a text box is tapped (or the keyboard comes up), it scrolls just
// enough that the box sits above whatever covers it: the keyboard with its Done key, or a button bar under the list.
// It measures once the keyboard has settled, so it works the same in a page that shrinks for the keyboard and in a
// sheet that rides up with it. Drag the page down to put the keyboard away; buttons work on the first tap.
import { forwardRef, useEffect, useImperativeHandle, useRef, type ComponentProps, type ComponentRef } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { TextInput as RNTextInput } from '@real/react-native';
import { FocusedInputEvents, KeyboardController, KeyboardEvents } from 'react-native-keyboard-controller';

/** Room kept under the text box: the Done key above the keyboard, plus a little air. */
const ROOM = 56;

type Scroll = ComponentRef<typeof ScrollView>;

export const FormScroll = forwardRef<Scroll | null, ComponentProps<typeof ScrollView>>(function FormScroll({ onScroll, ...props }, ref) {
  const inner = useRef<Scroll>(null);
  const offset = useRef(0);
  const kb = useRef(0);
  const { height: screen } = useWindowDimensions();
  useImperativeHandle(ref, () => inner.current as Scroll, []);

  useEffect(() => {
    // Bring the focused box into view, measured on screen (so it counts the sheet's lift and the page's shrink).
    const reveal = () =>
      setTimeout(() => {
        const box = RNTextInput.State?.currentlyFocusedInput?.() as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
        const list = inner.current as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
        if (!box?.measureInWindow || !list?.measureInWindow || !kb.current) return;
        list.measureInWindow((_lx, ly, _lw, lh) =>
          box.measureInWindow!((_x, y, _w, h) => {
            if (y + h < ly || y > ly + lh + kb.current) return; // not in this list
            const bottom = Math.min(ly + lh, screen - kb.current) - ROOM;
            const top = ly + 12;
            if (y + h > bottom) inner.current?.scrollTo({ y: offset.current + (y + h - bottom), animated: true });
            else if (y < top) inner.current?.scrollTo({ y: Math.max(0, offset.current - (top - y)), animated: true });
          }),
        );
      }, 60);
    const shown = KeyboardEvents.addListener('keyboardDidShow', (e) => {
      kb.current = e.height;
      reveal();
    });
    const hidden = KeyboardEvents.addListener('keyboardDidHide', () => (kb.current = 0));
    // Moving to another box while the keyboard is already up.
    const moved = FocusedInputEvents.addListener('focusDidSet', () => KeyboardController.isVisible() && reveal());
    return () => {
      shown.remove();
      hidden.remove();
      moved.remove();
    };
  }, [screen]);

  return (
    <ScrollView
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...props}
      ref={inner}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
    />
  );
});
