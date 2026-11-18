import React, { useEffect, useState } from 'react';
import { Expense, Fund, Member, SoccerState } from '../types';
import { formatMoney, fundTotals, monthKey, monthLabel, randomId } from '../utils';
import Avatar from './Avatar';
import MoneyInput from './MoneyInput';

interface Props {
  state: SoccerState;
  /** True once the fund is unlocked with the PIN. */
  isAdmin: boolean;
  lockState: 'locked' | 'unlocked' | 'disabled';
  onUnlock: () => void;
  onLock: () => void;
  onTogglePaid: (fundId: string, memberId: string, month: string) => void;
  onSetFee: (fundId: string, fee: number) => void;
  onAddExpense: (fundId: string, expense: Expense) => void;
  onRemoveExpense: (fundId: string, expenseId: string) => void;
  onCreateFund: (name: string, startDate: string) => string;
  onCloseFund: (fundId: string) => void;
  onReopenFund: (fundId: string) => void;
  onDeleteFund: (fundId: string) => void;
  onEditFund: (fundId: string, name: string, startDate: string) => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (value?: string) => (value ? value.split('-').reverse().join('/') : '');

/* ---------- one fund: month picker, fee, totals, who paid, expenses ---------- */

interface ViewProps {
  fund: Fund;
  members: Member[];
  /** Can record payments and expenses (fund unlocked and the fund is still open). */
  canEdit: boolean;
  onTogglePaid: (memberId: string, month: string) => void;
  onSetFee: (fee: number) => void;
  onAddExpense: (expense: Expense) => void;
  onRemoveExpense: (id: string) => void;
}

const FundView = ({ fund, members, canEdit, onTogglePaid, onSetFee, onAddExpense, onRemoveExpense }: ViewProps) => {
  const initialMonth = () => {
    if (fund.status === 'closed') {
      const last = Object.keys(fund.payments).sort().pop();
      return last || (fund.closedAt || fund.startDate).slice(0, 7);
    }
    return monthKey();
  };
  const [month, setMonth] = useState(initialMonth);
  const [feeDraft, setFeeDraft] = useState(fund.fee);
  const [exp, setExp] = useState({ date: today(), note: '', amount: 0 });
  const [expError, setExpError] = useState('');
  useEffect(() => setFeeDraft(fund.fee), [fund.fee]);

  const paid = new Set(fund.payments[month] || []);
  const paidMembers = members.filter((m) => paid.has(m.id));
  const unpaidMembers = members.filter((m) => !paid.has(m.id));
  // Totals assume the fund's fee applied to every recorded month.
  const { paidCount, totalIn, totalOut, balance } = fundTotals(fund);
  const monthExpenses = fund.expenses.filter((e) => e.date.startsWith(month));
  const percent = members.length ? Math.round((paidMembers.length / members.length) * 100) : 0;

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = exp.amount;
    if (!exp.note.trim()) { setExpError('Nhập nội dung khoản chi.'); return; }
    if (!amount) { setExpError('Nhập số tiền lớn hơn 0.'); return; }
    onAddExpense({ id: randomId(), date: exp.date, note: exp.note.trim().slice(0, 120), amount });
    setExp({ date: today(), note: '', amount: 0 });
    setExpError('');
  };

  return (
    <div className="sc-fund-view">
      <div className="sc-fund-top">
        <label className="sc-select">
          <span>Tháng</span>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
        {canEdit ? (
          <form className="sc-fee" onSubmit={(e) => { e.preventDefault(); if (feeDraft >= 0) onSetFee(feeDraft); }}>
            <label htmlFor={`sc-fee-${fund.id}`}>Tiền quỹ mỗi tháng</label>
            <div><MoneyInput id={`sc-fee-${fund.id}`} value={feeDraft} onChange={setFeeDraft} placeholder="100.000" /><button className="sc-btn small" type="submit">Lưu</button></div>
          </form>
        ) : (
          <span className="sc-muted">Tiền quỹ: <b>{formatMoney(fund.fee)}</b>/người/tháng</span>
        )}
      </div>

      <div className="sc-stats">
        <div className="sc-stat">
          <small>Đã đóng {monthLabel(month).toLowerCase()}</small>
          <b>{paidMembers.length}/{members.length}</b>
          <span className="sc-progress" aria-hidden="true"><span style={{ width: `${percent}%` }}></span></span>
        </div>
        <div className="sc-stat"><small>Thu trong tháng</small><b>{formatMoney(paidMembers.length * fund.fee)}</b><span>còn thiếu {formatMoney(unpaidMembers.length * fund.fee)}</span></div>
        <div className="sc-stat"><small>Tổng đã thu</small><b>{formatMoney(totalIn)}</b><span>{paidCount} lượt đóng</span></div>
        <div className="sc-stat"><small>Tổng đã chi</small><b>{formatMoney(totalOut)}</b><span>{fund.expenses.length} khoản</span></div>
        <div className="sc-stat highlight"><small>Số dư quỹ</small><b>{formatMoney(balance)}</b></div>
      </div>

      <div className="sc-two">
        <div className="sc-panel">
          <h3>Chưa đóng <small>{unpaidMembers.length}</small></h3>
          <ul className="sc-paylist">
            {unpaidMembers.map((m) => (
              <li key={m.id}>
                <Avatar member={m} size={30} /><span className="sc-grow">{m.name}</span>
                {canEdit && <button type="button" className="sc-btn small" onClick={() => onTogglePaid(m.id, month)}>Đã đóng</button>}
              </li>
            ))}
            {!unpaidMembers.length && <li className="sc-muted">Cả nhóm đã đóng đủ.</li>}
          </ul>
        </div>
        <div className="sc-panel">
          <h3>Đã đóng <small>{paidMembers.length}</small></h3>
          <ul className="sc-paylist">
            {paidMembers.map((m) => (
              <li key={m.id}>
                <Avatar member={m} size={30} /><span className="sc-grow">{m.name}</span>
                <i className="bx bx-check-circle sc-ok" aria-label="Đã đóng"></i>
                {canEdit && <button type="button" className="sc-btn ghost small" onClick={() => onTogglePaid(m.id, month)}>Hoàn tác</button>}
              </li>
            ))}
            {!paidMembers.length && <li className="sc-muted">Chưa ai đóng tháng này.</li>}
          </ul>
        </div>
      </div>

      <div className="sc-panel">
        <h3>Khoản chi {monthLabel(month).toLowerCase()}</h3>
        {monthExpenses.length ? (
          <ul className="sc-expenses">
            {monthExpenses.map((e) => (
              <li key={e.id}>
                <span className="sc-muted">{fmtDate(e.date)}</span>
                <span className="sc-grow">{e.note}</span>
                <b>{formatMoney(e.amount)}</b>
                {canEdit && <button type="button" className="sc-icon-btn" aria-label={`Xóa khoản chi ${e.note}`} onClick={() => window.confirm(`Xóa khoản chi "${e.note}"?`) && onRemoveExpense(e.id)}><i className="bx bx-trash"></i></button>}
              </li>
            ))}
          </ul>
        ) : <p className="sc-muted">Chưa có khoản chi nào trong tháng.</p>}

        {canEdit && (
          <form className="sc-expense-form" onSubmit={submitExpense} noValidate>
            <label><span>Ngày</span><input type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value || today() })} /></label>
            <label className="sc-grow"><span>Nội dung</span><input value={exp.note} maxLength={120} placeholder="Tiền sân, nước, áo..." onChange={(e) => { setExp({ ...exp, note: e.target.value }); setExpError(''); }} /></label>
            <label><span>Số tiền (đ)</span><MoneyInput value={exp.amount} placeholder="300.000" onChange={(amount) => { setExp({ ...exp, amount }); setExpError(''); }} /></label>
            <button type="submit" className="sc-btn">Thêm khoản chi</button>
            {expError && <small className="sc-error" role="alert">{expError}</small>}
          </form>
        )}
      </div>
    </div>
  );
};

/* ---------- dialogs ---------- */

const CreateFundDialog = ({ fund, onClose, onSubmit }: { fund?: Fund; onClose: () => void; onSubmit: (name: string, startDate: string) => void }) => {
  const [name, setName] = useState(fund ? fund.name : '');
  const [date, setDate] = useState(fund ? fund.startDate : today());
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Nhập tên đợt quỹ.'); return; }
    if (!date) { setError('Chọn ngày áp dụng.'); return; }
    onSubmit(name.trim().slice(0, 60), date);
  };

  return (
    <div className="sc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sc-dialog small" role="dialog" aria-modal="true" aria-labelledby="sc-newfund-title" onSubmit={submit} noValidate>
        <button type="button" className="sc-close" onClick={onClose} aria-label="Đóng"><i className="bx bx-x"></i></button>
        <h2 id="sc-newfund-title">{fund ? 'Sửa quỹ' : 'Tạo quỹ'}</h2>
        <p className="sc-muted">{fund ? 'Đổi tên đợt quỹ hoặc ngày áp dụng. Danh sách đóng tiền và khoản chi giữ nguyên.' : 'Mỗi đợt quỹ có danh sách đóng tiền và khoản chi riêng. Đóng quỹ khi kết thúc để lưu vào lịch sử.'}</p>
        <label className="sc-field">
          <span>Tên đợt quỹ</span>
          <input autoFocus value={name} maxLength={60} placeholder="Quỹ mùa đông 2026" aria-label="Tên đợt quỹ"
            onChange={(e) => { setName(e.target.value); setError(''); }} />
        </label>
        <label className="sc-field">
          <span>Ngày áp dụng</span>
          <input type="date" value={date} aria-label="Ngày áp dụng" onChange={(e) => { setDate(e.target.value); setError(''); }} />
        </label>
        {error && <small className="sc-error" role="alert">{error}</small>}
        <button type="submit" className="sc-btn"><i className={`bx ${fund ? 'bx-save' : 'bx-plus'}`} aria-hidden="true"></i>{fund ? 'Lưu' : 'Tạo quỹ'}</button>
      </form>
    </div>
  );
};

interface ConfirmState { title: string; text: string; label: string; danger?: boolean; onOk: () => void }

const ConfirmDialog = ({ confirm, onCancel }: { confirm: ConfirmState; onCancel: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="sc-confirm-layer" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="sc-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sc-fund-confirm-title">
        <i className={`bx ${confirm.danger ? 'bx-trash' : 'bx-error-circle'}`} aria-hidden="true"></i>
        <h3 id="sc-fund-confirm-title">{confirm.title}</h3>
        <p>{confirm.text}</p>
        <div className="sc-confirm-actions">
          <button type="button" className="sc-btn ghost" autoFocus onClick={onCancel}>Hủy</button>
          <button type="button" className={`sc-btn${confirm.danger ? ' sc-btn-danger' : ''}`} onClick={() => { confirm.onOk(); onCancel(); }}>{confirm.label}</button>
        </div>
      </div>
    </div>
  );
};

/* ---------- history ---------- */

const MonthBreakdown = ({ fund, memberCount }: { fund: Fund; memberCount: number }) => {
  const months = Object.keys(fund.payments).sort();
  if (!months.length) return null;
  return (
    <div className="sc-panel sc-month-table">
      <h3>Thu theo tháng</h3>
      <ul>
        {months.map((m) => (
          <li key={m}>
            <span className="sc-grow">{monthLabel(m)}</span>
            <span className="sc-muted">{fund.payments[m].length}/{memberCount} người</span>
            <b>{formatMoney(fund.payments[m].length * fund.fee)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ---------- tab ---------- */

const FundTab = ({
  state, isAdmin, lockState, onUnlock, onLock, onTogglePaid, onSetFee, onAddExpense, onRemoveExpense,
  onCreateFund, onCloseFund, onReopenFund, onDeleteFund, onEditFund,
}: Props) => {
  const [view, setView] = useState<'open' | 'history'>('open');
  const [openFundId, setOpenFundId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const openFunds = state.funds.filter((f) => f.status === 'open').sort((a, b) => b.startDate.localeCompare(a.startDate));
  const closedFunds = state.funds.filter((f) => f.status === 'closed')
    .sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || '') || b.startDate.localeCompare(a.startDate));

  const askClose = (f: Fund) => setConfirm({
    title: 'Đóng quỹ?', label: 'Đóng quỹ',
    text: `"${f.name}" sẽ chuyển vào Lịch sử quỹ và không thể ghi thêm đóng tiền hay khoản chi (có thể mở lại).`,
    onOk: () => { onCloseFund(f.id); setView('history'); setExpandedId(f.id); },
  });
  const askDelete = (f: Fund) => setConfirm({
    title: 'Xóa quỹ?', label: 'Xóa quỹ', danger: true,
    text: `Toàn bộ danh sách đóng tiền và khoản chi của "${f.name}" sẽ bị xóa, không thể khôi phục.`,
    onOk: () => onDeleteFund(f.id),
  });

  return (
    <section aria-label="Quỹ">
      {lockState !== 'disabled' && (
        <div className={`sc-lockbar${isAdmin ? ' open' : ''}`}>
          <i className={`bx ${isAdmin ? 'bx-lock-open-alt' : 'bx-lock-alt'}`} aria-hidden="true"></i>
          <span className="sc-grow">{isAdmin ? 'Quỹ đang mở khóa, bạn có thể ghi nhận đóng quỹ và khoản chi.' : 'Quỹ đang khóa. Nhập mã PIN để cập nhật.'}</span>
          {isAdmin
            ? <button type="button" className="sc-btn ghost small" onClick={onLock}>Khóa lại</button>
            : <button type="button" className="sc-btn small" onClick={onUnlock}>Mở khóa quỹ</button>}
        </div>
      )}

      <div className="sc-fund-bar">
        <div className="sc-style-picker sc-fund-switch" role="tablist" aria-label="Danh sách quỹ">
          <button type="button" role="tab" aria-selected={view === 'open'} className={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>
            Đang mở <b>{openFunds.length}</b>
          </button>
          <button type="button" role="tab" aria-selected={view === 'history'} className={view === 'history' ? 'on' : ''} onClick={() => setView('history')}>
            <i className="bx bx-history" aria-hidden="true"></i>Lịch sử quỹ <b>{closedFunds.length}</b>
          </button>
        </div>
        {isAdmin && (
          <button type="button" className="sc-btn small" onClick={() => setCreating(true)}><i className="bx bx-plus" aria-hidden="true"></i>Tạo quỹ</button>
        )}
      </div>

      {view === 'open' && (
        openFunds.length ? (
          <div className="sc-fund-acc">
            {openFunds.map((f) => {
              const expanded = openFundId === f.id;
              const toggle = () => setOpenFundId(expanded ? '' : f.id);
              return (
                <div key={f.id} className={`sc-fund-item${expanded ? ' open' : ''}`}>
                  <div className="sc-fund-head" role="button" tabIndex={0} aria-expanded={expanded} onClick={toggle}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } }}>
                    <div className="sc-fund-title">
                      <h2>{f.name}</h2>
                      <p className="sc-muted"><i className="bx bx-calendar" aria-hidden="true"></i> Áp dụng từ {fmtDate(f.startDate)} <span className="sc-chip ok">Đang mở</span></p>
                    </div>
                    <div className="sc-row-gap">
                      {isAdmin && (
                        <>
                          <button type="button" className="sc-btn ghost small" onClick={(e) => { e.stopPropagation(); setEditingFund(f); }}><i className="bx bx-edit-alt" aria-hidden="true"></i>Sửa</button>
                          <button type="button" className="sc-btn ghost small" onClick={(e) => { e.stopPropagation(); askClose(f); }}><i className="bx bx-lock-alt" aria-hidden="true"></i>Đóng quỹ</button>
                          <button type="button" className="sc-btn ghost small sc-danger" onClick={(e) => { e.stopPropagation(); askDelete(f); }}><i className="bx bx-trash" aria-hidden="true"></i>Xóa quỹ</button>
                        </>
                      )}
                      <i className={`bx bx-chevron-down sc-fund-chevron${expanded ? ' up' : ''}`} aria-hidden="true"></i>
                    </div>
                  </div>
                  {expanded && (
                    <FundView fund={f} members={state.members} canEdit={isAdmin}
                      onTogglePaid={(memberId, month) => onTogglePaid(f.id, memberId, month)}
                      onSetFee={(fee) => onSetFee(f.id, fee)}
                      onAddExpense={(e) => onAddExpense(f.id, e)}
                      onRemoveExpense={(id) => onRemoveExpense(f.id, id)} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="sc-empty sc-fund-empty">
            <i className="bx bx-wallet" aria-hidden="true"></i>
            <p>Chưa có quỹ nào đang mở.{closedFunds.length ? ' Xem các quỹ cũ ở Lịch sử quỹ.' : ''}{!isAdmin && lockState !== 'disabled' ? ' Mở khóa bằng mã PIN để tạo quỹ.' : ''}</p>
            {isAdmin && <button type="button" className="sc-btn" onClick={() => setCreating(true)}><i className="bx bx-plus" aria-hidden="true"></i>Tạo quỹ</button>}
          </div>
        )
      )}

      {view === 'history' && (
        closedFunds.length ? (
          <div className="sc-fund-history">
            {closedFunds.map((f) => {
              const t = fundTotals(f);
              const open = expandedId === f.id;
              return (
                <article key={f.id} className={`sc-fund-card${open ? ' open' : ''}`}>
                  <header>
                    <div className="sc-fund-title">
                      <h3>{f.name}</h3>
                      <p className="sc-muted"><i className="bx bx-calendar" aria-hidden="true"></i> {fmtDate(f.startDate)} → {fmtDate(f.closedAt)} <span className="sc-chip">Đã đóng</span></p>
                    </div>
                    <button type="button" className="sc-btn ghost small" aria-expanded={open} onClick={() => setExpandedId(open ? '' : f.id)}>
                      {open ? 'Thu gọn' : 'Xem chi tiết'}<i className={`bx ${open ? 'bx-chevron-up' : 'bx-chevron-down'}`} aria-hidden="true"></i>
                    </button>
                  </header>
                  <div className="sc-fund-sum">
                    <div><small>Đã thu</small><b>{formatMoney(t.totalIn)}</b><span>{t.paidCount} lượt đóng</span></div>
                    <div><small>Đã chi</small><b>{formatMoney(t.totalOut)}</b><span>{f.expenses.length} khoản</span></div>
                    <div className={t.balance < 0 ? 'neg' : 'pos'}><small>Số dư</small><b>{formatMoney(t.balance)}</b><span>{formatMoney(f.fee)}/người/tháng</span></div>
                  </div>
                  {open && (
                    <div className="sc-fund-detail">
                      <MonthBreakdown fund={f} memberCount={state.members.length} />
                      <FundView fund={f} members={state.members} canEdit={false} onTogglePaid={() => undefined} onSetFee={() => undefined} onAddExpense={() => undefined} onRemoveExpense={() => undefined} />
                    </div>
                  )}
                  {isAdmin && (
                    <footer>
                      <button type="button" className="sc-btn ghost small" onClick={() => setEditingFund(f)}><i className="bx bx-edit-alt" aria-hidden="true"></i>Sửa</button>
                      <button type="button" className="sc-btn ghost small" onClick={() => onReopenFund(f.id)}><i className="bx bx-lock-open-alt" aria-hidden="true"></i>Mở lại quỹ</button>
                      <button type="button" className="sc-btn ghost small sc-danger" onClick={() => askDelete(f)}><i className="bx bx-trash" aria-hidden="true"></i>Xóa quỹ</button>
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="sc-empty">Chưa có quỹ nào được đóng. Quỹ đã đóng sẽ nằm ở đây cùng thông tin chi tiết.</p>
        )
      )}

      {creating && <CreateFundDialog onClose={() => setCreating(false)} onSubmit={(name, date) => { const id = onCreateFund(name, date); setOpenFundId(id); setView('open'); setCreating(false); }} />}
      {editingFund && <CreateFundDialog key={editingFund.id} fund={editingFund} onClose={() => setEditingFund(null)} onSubmit={(name, date) => { onEditFund(editingFund.id, name, date); setEditingFund(null); }} />}
      {confirm && <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} />}
    </section>
  );
};

export default FundTab;
