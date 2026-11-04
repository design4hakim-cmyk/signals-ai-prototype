import { Modal } from '@/components/ui/Modal';
import { unrunLines, usePine } from '@/store/pine';
import { useStrategy } from '@/store/strategy';

/*
  Edge cases where saving and trading meet (Top nav sheet, section 5).
  • Update while Live — never changes real-money trading silently; offers a copy.
  • Trade with unsaved edits — default action saves, so what you trade is what you see.
*/

export type TradeDialog = 'unsaved' | 'live' | 'unrunSave' | 'unrunTrade' | null;

export function TradeDialogs({ open, onClose, onSave }: { open: TradeDialog; onClose: () => void; onSave?: () => void }) {
  const st = useStrategy();
  const liveCount = st.liveTrades.length;
  const pine = usePine();
  const n = unrunLines(pine);

  // design/pine-editor §6: Save and Trade only ever use code that ran
  if (open === 'unrunSave') {
    return (
      <Modal
        title={`Run your ${n} line${n > 1 ? 's' : ''} first?`}
        onClose={onClose}
        secondary={{ label: 'Save without them', onClick: () => { onClose(); onSave?.(); } }}
        primary={{
          label: 'Run & save',
          onClick: () => {
            onClose();
            pine.run();
            // save once the run lands (the strategy saves what ran)
            setTimeout(() => usePine.getState().code === usePine.getState().ran && onSave?.(), 700);
          },
        }}
      >
        The Pine Script editor has {n > 1 ? `${n} lines that haven’t` : '1 line that hasn’t'} run. Saving keeps the last code that ran; your draft stays in the editor.
      </Modal>
    );
  }
  if (open === 'unrunTrade') {
    return (
      <Modal
        title="Run or discard your code first"
        onClose={onClose}
        secondary={{ label: 'Discard them', onClick: () => { onClose(); pine.discard(); } }}
        primary={{ label: 'Run', onClick: () => { onClose(); pine.run(); } }}
      >
        {n > 1 ? `${n} lines` : '1 line'} in the Pine Script editor {n > 1 ? 'haven’t' : 'hasn’t'} run. Live and forward tests only use code that ran, so trading waits until you Run or Discard.
      </Modal>
    );
  }

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
