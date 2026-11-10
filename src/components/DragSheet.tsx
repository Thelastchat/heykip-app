// The bottom card every sheet sits in. Drag it down to close it: from the grip and title anywhere, and from the rest of
// the card when nothing inside it wants the drag (a list that scrolls, a slider, the graph). Let go early and it
// springs back. A card pinned to the bottom (position: absolute) also rides up with the keyboard — a pinned view
// ignores the keyboard padding around it — and is never taller than the space above the keyboard (its list scrolls).
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardController, useKeyboardAnimation, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The top of the card (grip and title) always takes a downward drag, even over a list. */
const GRAB = 72;
/** Further than this, or a quick flick, closes it. */
const CLOSE_AT = 110;

export function DragSheet({ onClose, style, children }: { onClose: () => void; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const { height: screen } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAnimation().height; // 0 when the keyboard is down, minus its height when up
  // Only a pinned card is lifted here; a card in the normal flow is already lifted by the KeyboardSafe around it.
  const pinned = StyleSheet.flatten(style)?.position === 'absolute';
  const kbHeight = useKeyboardState((s) => (pinned && s.isVisible ? s.height : 0));
  const drag = useRef(new Animated.Value(0)).current;
  const layoutTop = useRef(0);
  const kbNow = useRef(0);
  kbNow.current = kbHeight;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // A sheet that is shown again (the same one, opened later) starts in place.
  useEffect(() => () => drag.setValue(0), [drag]);

  const pan = useMemo(() => {
    const down = (dx: number, dy: number, min: number) => dy > min && dy > Math.abs(dx) * 1.3;
    const back = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 8, speed: 14 }).start();
    return PanResponder.create({
      // The grip and title: take it before anything inside does.
      onMoveShouldSetPanResponderCapture: (e, g) => e.nativeEvent.pageY - g.dy - (layoutTop.current - kbNow.current) < GRAB && down(g.dx, g.dy, 4),
      // Anywhere else: only when nothing inside took it.
      onMoveShouldSetPanResponder: (_, g) => down(g.dx, g.dy, 8),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => KeyboardController.dismiss(),
      onPanResponderMove: (_, g) => drag.setValue(g.dy > 0 ? g.dy : g.dy * 0.15),
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_AT || (g.dy > 30 && g.vy > 0.6)) {
          Animated.timing(drag, { toValue: screen, duration: 200, useNativeDriver: true }).start(() => {
            closeRef.current();
            // Put it back once the sheet has gone, for a sheet that stays mounted and opens again.
            setTimeout(() => drag.setValue(0), 400);
          });
        } else back();
      },
      onPanResponderTerminate: back,
    });
  }, [drag, screen]);

  return (
    <Animated.View
      {...pan.panHandlers}
      onLayout={(e) => (layoutTop.current = e.nativeEvent.layout.y)}
      style={[
        style,
        // With the keyboard up the card moves up by its height, so it can be at most the space above it.
        kbHeight ? { maxHeight: screen - kbHeight - insets.top - 8 } : null,
        { transform: [{ translateY: pinned ? Animated.add(kb, drag) : drag }] },
      ]}>
      {children}
    </Animated.View>
  );
}
