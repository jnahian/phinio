import {
  forwardRef,
  ReactNode,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import { StyleSheet, View } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetProps,
} from '@gorhom/bottom-sheet'
import { GlassSurface } from './GlassSurface'
import { useTheme } from '#/theme/use-theme'

export type GlassSheetHandle = {
  expand: () => void
  collapse: () => void
  close: () => void
}

export type GlassSheetProps = Omit<
  BottomSheetProps,
  'children' | 'snapPoints' | 'backdropComponent'
> & {
  snapPoints?: BottomSheetProps['snapPoints']
  children?: ReactNode
}

/**
 * Glass-styled wrapper around `@gorhom/bottom-sheet`. Forwards a small
 * imperative handle (`expand` / `collapse` / `close`) so callers don't
 * have to import the sheet's ref type.
 *
 * Notes:
 * - `@gorhom/bottom-sheet` requires `react-native-gesture-handler` and
 *   `react-native-reanimated`; both are installed in Phase 3C. The app
 *   root must be wrapped in `<GestureHandlerRootView>` for gestures to
 *   register — that's wired in `app/_layout.tsx`.
 * - The backdrop and content background are both glass surfaces, so
 *   the sheet inherits the resolved tier automatically.
 */
export const GlassSheet = forwardRef<GlassSheetHandle, GlassSheetProps>(
  function GlassSheet({ snapPoints, children, ...rest }, ref) {
    const sheetRef = useRef<BottomSheet>(null)
    const { colors } = useTheme()
    const defaultSnapPoints = useMemo(
      () => snapPoints ?? (['40%', '90%'] as (string | number)[]),
      [snapPoints],
    )

    useImperativeHandle(ref, () => ({
      expand: () => sheetRef.current?.expand(),
      collapse: () => sheetRef.current?.collapse(),
      close: () => sheetRef.current?.close(),
    }))

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      ),
      [],
    )

    return (
      <BottomSheet
        ref={sheetRef}
        snapPoints={defaultSnapPoints}
        index={-1}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundComponent={() => (
          <GlassSurface
            style={StyleSheet.absoluteFill}
            borderRadius={24}
          />
        )}
        handleIndicatorStyle={{ backgroundColor: colors.outline }}
        {...rest}
      >
        <View style={styles.content}>{children}</View>
      </BottomSheet>
    )
  },
)

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
})
