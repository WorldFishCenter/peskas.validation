import React from 'react';
import { IconMessage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface FeedbackModalProps {
  src: string;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ src, onClose }) => {
  const { t } = useTranslation('navigation');

  return (
    <>
      <div className="modal modal-blur show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <IconMessage className="icon text-blue me-2" size={24} stroke={2} />
                {t('feedback.title')}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label={t('buttons.close', { ns: 'common' })}
              ></button>
            </div>
            <div className="modal-body p-0">
              <iframe
                src={src}
                title={t('feedback.title')}
                className="w-100 border-0"
                style={{ height: '70vh' }}
              ></iframe>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
    </>
  );
};

export default FeedbackModal;
