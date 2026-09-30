---
name: native-dialog-to-react-modal
description: Replacing window.confirm/alert with a React modal silently drops guarantees the native dialog gave for free — check the list before passing the swap
metadata:
  type: reference
---

`window.confirm()` blocks the JS thread and is a true OS-level modal. A React modal is neither. When reviewing a swap (a legitimate one — iOS Safari suppresses in-page JS dialogs and a suppressed `confirm()` returns `false`, so `if (!confirmed) return;` bails silently), check what was lost:

1. **Precondition freeze.** `confirm()` froze the world: no timers, no polling, no re-render between the tap and the answer. A React dialog can sit open while SWR/websocket data changes underneath it. Gate the dialog's render on the *same* condition that rendered the trigger button (not merely on "data exists"), or re-check inside the confirm handler. Otherwise the user confirms an action whose precondition has since evaporated on another device.
2. **Idempotency of the confirmed action.** Follows from (1) — check the endpoint. An unguarded `UPDATE ... SET endTime = now()` will happily overwrite a real timestamp on a second call.
3. **Escape to cancel.** Native confirm cancels on Escape; a hand-rolled dialog usually has no keydown handler.
4. **Real modality.** Native confirm traps focus, blocks background interaction, and is announced. A `fixed inset-0` div blocks *pointer* events only — background controls stay Tab-reachable and in the a11y tree. Needs `role="dialog"` + `aria-modal` + `aria-labelledby`, initial focus, and ideally `inert` on the background.
5. **Unconditional visibility.** `alert()` was always on screen. Its in-page replacement (banner/toast) must be `sticky`/`fixed`, or it renders off-screen when the page is scrolled — which recreates the exact "nothing happened" symptom the swap was meant to cure.
6. **Leftover open-state.** The boolean/object driving the dialog must be cleared by every path that resets the surrounding context, or the dialog reappears against the next record.

**How to apply**: run this list on any `window.confirm`/`window.alert` → custom-dialog migration. Items 1, 2 and 5 are the ones that produce real user-visible bugs; 3 and 4 are usually consistent with the codebase's existing modals and worth flagging as non-blocking.
