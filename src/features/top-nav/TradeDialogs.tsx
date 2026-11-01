import { Modal } from '@/components/ui/Modal';
import { useStrategy } from '@/store/strategy';

/*
  Edge cases where saving and trading meet (Top nav sheet, section 5).
  • Update while Live — never changes real-money trading silently; offers a copy.
  • Trade with unsaved edits — default action saves, so what you trade is what you see.
*/

export function TradeDialogs({ open, onClose }: { open: 'unsaved' | 'live' | null; onClose: () => void }) {
  const st = useStrategy();
  const liveCount = st.liveTrades.length;

  if (open === 'live') {
    return (
      <Modal
        title="Update a live strategy?"
        onClose={onClose}
        secondary={{
          label: 'Save as copy instead',
          onClick: () => {
            onClose();
            st.set({ name: `${st.name} copy`, dirty: false, forwardTests: [], liveTrades: [], saved: true });
            st.showToast('Saved as a copy. The live strategy is unchanged.');
          },
        }}
        primary={{ label: 'Update live strategy', onClick: () => { onClose(); st.save(); } }}
      >
        This strategy is live in {liveCount} trade{liveCount > 1 ? 's' : ''}. Changes apply from the next market
        session; open positions aren't touched.
      </Modal>
    );
  }
  if (open === 'unsaved') {
    return (
      <Modal
        title="You have unsaved changes"
        onClose={onClose}
        secondary={
          st.saved
            ? { label: 'Trade saved version', onClick: () => { onClose(); st.showToast('Trade popup opens with the saved version'); } }
            : undefined
        }
        primary={{
          label: st.saved ? 'Update & continue' : 'Save & continue',
          onClick: () => {
            onClose();
            if (st.saved) st.save();
            else st.startNaming();
          },
        }}
      >
        Trade runs the saved version. Save your changes first so what you trade is what you see.
      </Modal>
    );
  }
  return null;
}
