import React, { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAvatar } from '../api';
import { Member, SoccerState } from '../types';
import { TIERS, formatMoney, monthKey, monthLabel, resizePhoto, resizeLogo, normalizeGiphyUrl, ratingOf, defaultStats, STAT_KEYS, STAT_LABELS, memberLedger, currentFund } from '../utils';
import Avatar, { ClubBackdrop } from './Avatar';
import { CLUBS, CUSTOM_CLUB, DEFAULT_CARD_COLOR, crestOf } from '../clubs';
import GifSearch from './GifSearch';
import PlayerCard from './PlayerCard';
import { useCardStyle } from '../cardStyle';

interface Props {
  member: Member;
  state: SoccerState;
  /** Can edit profile, tier, number, photo and goals (open to everyone). */
  isAdmin: boolean;
  /** Can change fund payments (needs the PIN). */
  fundUnlocked: boolean;
  onChange: (member: Member) => void;
  onTogglePaid: (memberId: string, month: string) => void;
  onRemove: (memberId: string) => void;
  onClose: () => void;
}

const MemberDetail = ({ member, state, isAdmin, fundUnlocked, onChange, onTogglePaid, onRemove, onClose }: Props) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(member.name);
  const [number, setNumber] = useState(member.number === null ? '' : String(member.number));
  const [numberError, setNumberError] = useState('');
  const [link, setLink] = useState(member.avatar.startsWith('https://') ? member.avatar : '');
  // Edits stay local until "Lưu" is pressed.
  const [tier, setTier] = useState(member.tier);
  const [goals, setGoals] = useState(member.goals);
  const [avatar, setAvatar] = useState(member.avatar);
  const [club, setClub] = useState(member.club || '');
  const [clubName, setClubName] = useState(member.clubName || '');
  const [clubLogo, setClubLogo] = useState(member.clubLogo || '');
  const [clubColor, setClubColor] = useState(member.clubColor || '');
  const [cardStyle] = useCardStyle();
  const [shape, setShape] = useState(member.avatarShape || 'circle');
  // One text box per attribute; empty = estimated from the rating.
  const [statDraft, setStatDraft] = useState<Record<string, string>>(() => Object.fromEntries(STAT_KEYS.map((k) => [k, member.stats ? String(member.stats[k]) : ''])));
  const [logoError, setLogoError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [gifFor, setGifFor] = useState<'' | 'avatar' | 'logo'>('');
  const [logoDraft, setLogoDraft] = useState(member.clubLogo?.startsWith('https://') ? member.clubLogo : '');
  const [nameError, setNameError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const thisMonth = monthKey();
  const activeFund = currentFund(state);
  const paidThisMonth = Boolean(activeFund && (activeFund.payments[thisMonth] || []).includes(member.id));
  const ledger = memberLedger(state, member.id);
  const paidMonths = ledger.paidMonths;
  const matchesPlayed = ledger.history.length;
  const draftNumber = number.trim() === '' ? null : Number(number);
  const sameNumber = draftNumber !== null ? state.members.find((m) => m.id !== member.id && m.number === draftNumber) : undefined;
  const preview = { ...member, name: name.trim() || member.name, avatar, club, clubName, clubLogo, clubColor, avatarShape: shape };
  const auto = defaultStats(ratingOf({ tier, goals }));
  const typedStats = STAT_KEYS.some((k) => statDraft[k].trim() !== '');
  const draftStats = typedStats
    ? (Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(1, Math.min(99, parseInt(statDraft[k], 10) || auto[k]))])) as unknown as NonNullable<Member['stats']>)
    : undefined;
  const statsChanged = JSON.stringify(draftStats || null) !== JSON.stringify(member.stats || null);
  const dirty = name.trim() !== member.name || draftNumber !== member.number || tier !== member.tier
    || goals !== member.goals || avatar !== member.avatar || shape !== (member.avatarShape || 'circle') || statsChanged || club !== (member.club || '')
    || (club === CUSTOM_CLUB && (clubName.trim() !== (member.clubName || '') || clubLogo !== (member.clubLogo || '') || clubColor !== (member.clubColor || '')));

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  confirmingRef.current = confirming;
  const requestClose = useCallback(() => {
    if (confirmingRef.current) { setConfirming(false); return; }
    if (dirtyRef.current) setConfirming(true);
    else onCloseRef.current();
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setLogoError('');
    setLogoBusy(true);
    try {
      const uploaded = await uploadAvatar(`club-${member.id}`, await resizeLogo(file));
      setClubLogo(uploaded);
      setLogoDraft('');
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Không tải logo lên được.');
    } finally {
      setLogoBusy(false);
    }
  };
  /** Applies the typed logo link; returns the final logo URL, or null when the link is not usable. */
  const applyLogoDraft = (): string | null => {
    const typed = logoDraft.trim();
    if (!typed) return clubLogo;
    const url = typed ? normalizeGiphyUrl(typed) : '';
    if (url === null) { setLogoError('Link rút gọn gph.is chưa dùng được. Dùng link giphy.com/gifs/...'); return null; }
    if (!/^https:\/\//i.test(url)) { setLogoError('Link logo phải bắt đầu bằng https://'); return null; }
    setLogoError('');
    setClubLogo(url);
    setLogoDraft(url);
    return url;
  };

  const applyLink = () => {
    const typed = link.trim();
    const url = typed ? normalizeGiphyUrl(typed) : '';
    if (url === null) {
      setPhotoError('Link rút gọn gph.is chưa dùng được. Mở GIF trên Giphy rồi copy link giphy.com/gifs/...');
      return false;
    }
    if (url !== typed) setLink(url);
    if (url && !/^https:\/\//i.test(url)) {
      setPhotoError('Link ảnh phải bắt đầu bằng https://');
      return false;
    }
    setPhotoError('');
    if (url && url !== avatar) setAvatar(url);
    return true;
  };

  const save = () => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) { setNameError('Nhập tên thành viên.'); return; }
    setNameError('');
    if (number.trim() !== '' && (!Number.isInteger(draftNumber) || (draftNumber as number) < 0 || (draftNumber as number) > 99)) {
      setNumberError('Số áo từ 0 đến 99.');
      return;
    }
    let nextLogo = clubLogo;
    if (club === CUSTOM_CLUB && logoDraft.trim()) {
      const applied = applyLogoDraft();
      if (applied === null) return;
      nextLogo = applied;
    }
    const typed = link.trim();
    let nextAvatar = avatar;
    if (typed) {
      const url = normalizeGiphyUrl(typed);
      if (!applyLink()) return;
      if (url && url !== avatar) nextAvatar = url;
    }
    if (dirty || nextAvatar !== member.avatar) {
      onChange({ ...member, name: trimmed, number: draftNumber, tier, goals, avatar: nextAvatar, club, clubName: club === CUSTOM_CLUB ? clubName.trim().slice(0, 40) : '', clubLogo: club === CUSTOM_CLUB ? nextLogo : '', clubColor: club === CUSTOM_CLUB ? clubColor : '', stats: draftStats, avatarShape: shape });
    }
    onClose();
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    setUploading(true);
    try {
      const photo = await resizePhoto(file);
      const uploaded = await uploadAvatar(member.id, photo);
      setAvatar(uploaded);
      setLink('');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Không tải ảnh lên được.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sc-overlay" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="sc-dialog detail" role="dialog" aria-modal="true" aria-labelledby="sc-detail-name" tabIndex={-1} ref={dialogRef}>
        <button type="button" className="sc-close" onClick={requestClose} aria-label="Đóng"><i className="bx bx-x"></i></button>

        <div className="sc-detail-head">
          <span className="sc-club-wrap">
            <ClubBackdrop club={club} logo={clubLogo} />
            {isAdmin ? (
              <button type="button" className="sc-photo-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Đổi ảnh đại diện">
                <Avatar member={preview} size={88} />
                <span className="sc-photo-badge" aria-hidden="true"><i className={`bx ${uploading ? 'bx-loader-alt bx-spin' : 'bx-camera'}`}></i></span>
              </button>
            ) : <Avatar member={member} size={88} />}
          </span>
          <div className="sc-detail-id">
            {isAdmin ? (
              <>
                <label className="sc-field sc-field-name">
                  <span>Tên</span>
                  <input id="sc-detail-name" className="sc-name-input" value={name} maxLength={60}
                    onChange={(e) => { setName(e.target.value); setNameError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && save()} />
                </label>
                <label className="sc-field sc-field-number">
                  <span>Số áo</span>
                  <input className="sc-number-input" inputMode="numeric" maxLength={2} value={number} placeholder="--"
                    onChange={(e) => { setNumber(e.target.value.replace(/[^0-9]/g, '')); setNumberError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && save()} />
                </label>
              </>
            ) : (
              <>
                <h2 id="sc-detail-name">{member.name}</h2>
                <span className="sc-shirt big">{member.number ?? "--"}</span>
              </>
            )}
          </div>
        </div>
        <div className="sc-dialog-body">
        {nameError && <small className="sc-error" role="alert">{nameError}</small>}
        {numberError && <small className="sc-error" role="alert">{numberError}</small>}
        {!numberError && sameNumber && <small className="sc-warn">Số {draftNumber} đang trùng với {sameNumber.name}.</small>}

        <div className="sc-preview">
          <PlayerCard variant={cardStyle === 'compact' ? 'ultimate' : cardStyle} member={{ ...preview, number: draftNumber, tier, goals, clubName, clubLogo, clubColor, stats: draftStats }} matches={matchesPlayed} />
          <div className="sc-preview-info">
            <span className="sc-label">Rating</span>
            <b className="sc-preview-score">{ratingOf({ tier, goals })}</b>
            <p className="sc-muted">Tier quyết định điểm nền (D 50, C 60, B 70, A 80, S 90). Cứ 2 bàn thắng cộng thêm 1 điểm, tối đa +9. Thẻ đổi ngay khi bạn sửa tên, số áo, tier, bàn thắng hay ảnh.</p>
          </div>
        </div>

        <div className="sc-tier-picker">
          <span className="sc-label">Tier (năng lực)</span>
          {isAdmin ? (
            <div className="sc-segment" role="radiogroup" aria-label="Tier">
              {[5, 4, 3, 2, 1].map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tier === t}
                  className={`t${t}${tier === t ? ' on' : ''}`} onClick={() => setTier(t)}>
                  <b>{TIERS[t].label}</b><small>{TIERS[t].name}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="sc-tier-static"><b className={`sc-tier big t${member.tier}`}>{TIERS[member.tier].label}</b><span>{TIERS[member.tier].name}</span></div>
          )}
        </div>

        {isAdmin && (
          <div className="sc-stats-edit">
            <span className="sc-label">Chỉ số thẻ</span>
            <div className="sc-stat-grid">
              {STAT_KEYS.map((k) => (
                <label key={k}><span>{STAT_LABELS[k]}</span>
                  <input inputMode="numeric" maxLength={2} value={statDraft[k]} placeholder={String(auto[k])}
                    onChange={(e) => setStatDraft({ ...statDraft, [k]: e.target.value.replace(/[^0-9]/g, '') })} /></label>
              ))}
            </div>
            <p className="sc-muted">Để trống thì tự ước tính từ rating. Điền một ô là các ô trống còn lại lấy theo ước tính.</p>
            {typedStats && <button type="button" className="sc-btn ghost small" onClick={() => setStatDraft(Object.fromEntries(STAT_KEYS.map((k) => [k, ''])))}>Dùng chỉ số tự ước tính</button>}
          </div>
        )}

        <div className="sc-club-picker">
          <span className="sc-label">Đội bóng yêu thích</span>
          {isAdmin ? (
            <div className="sc-club-list" role="radiogroup" aria-label="Đội bóng yêu thích">
              <button type="button" role="radio" aria-checked={!club} className={`none${!club ? ' on' : ''}`} onClick={() => setClub('')}>Không</button>
              {CLUBS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={club === c.id} title={c.name} aria-label={c.name}
                  className={club === c.id ? 'on' : ''} onClick={() => setClub(c.id)}>
                  <img src={c.crest} alt="" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              ))}
              <button type="button" role="radio" aria-checked={club === CUSTOM_CLUB} className={`none${club === CUSTOM_CLUB ? ' on' : ''}`} onClick={() => setClub(CUSTOM_CLUB)}>
                <span><i className="bx bx-plus" aria-hidden="true"></i>Khác</span>
              </button>
            </div>
          ) : <span className="sc-muted">{crestOf(member)?.name || 'Chưa chọn'}</span>}
          {isAdmin && club === CUSTOM_CLUB && (
            <div className="sc-custom-club">
              <span className="sc-club-preview">{clubLogo ? <img src={clubLogo} alt="" referrerPolicy="no-referrer" onError={() => setLogoError('Không tải được logo từ link này.')} /> : <i className="bx bx-shield-quarter" aria-hidden="true"></i>}</span>
              <div className="sc-custom-club-fields">
                <label className="sc-link-field"><span>Tên đội</span>
                  <input value={clubName} maxLength={40} placeholder="VD: Hà Nội FC" onChange={(e) => setClubName(e.target.value)} /></label>
                <label className="sc-link-field sc-color-field"><span>Màu thẻ cầu thủ</span>
                  <input type="color" value={clubColor || DEFAULT_CARD_COLOR} onChange={(e) => setClubColor(e.target.value)} /></label>
                <label className="sc-link-field"><span>Link logo (https, hỗ trợ cả link Giphy)</span>
                  <input value={logoDraft} placeholder="https://..." maxLength={400}
                    onChange={(e) => { setLogoDraft(e.target.value); setLogoError(''); }}
                    onBlur={() => logoDraft.trim() && applyLogoDraft()} /></label>
                <div className="sc-row-gap">
                  <button type="button" className="sc-btn small" onClick={() => logoFileRef.current?.click()} disabled={logoBusy}>
                    <i className={`bx ${logoBusy ? 'bx-loader-alt bx-spin' : 'bx-image-add'}`} aria-hidden="true"></i>{logoBusy ? 'Đang tải lên' : 'Tải logo từ máy'}
                  </button>
                  <button type="button" className="sc-btn ghost small" onClick={() => setGifFor(gifFor === 'logo' ? '' : 'logo')}><i className="bx bx-search-alt" aria-hidden="true"></i>Tìm GIF</button>
                  {clubLogo && <button type="button" className="sc-btn ghost small" onClick={() => { setClubLogo(''); setLogoDraft(''); setLogoError(''); }}><i className="bx bx-trash" aria-hidden="true"></i>Xóa logo</button>}
                </div>
                {gifFor === 'logo' && <GifSearch onClose={() => setGifFor('')}
                  onPick={(url) => { setClubLogo(url); setLogoDraft(url); setLogoError(''); setGifFor(''); }} />}
                <input ref={logoFileRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
                {logoError && <small className="sc-error" role="alert">{logoError}</small>}
              </div>
            </div>
          )}
        </div>

        <div className="sc-detail-grid">
          <div className="sc-stat">
            <small>Bàn thắng</small>
            <b className="sc-goals"><i key={goals} className="bx bx-football" aria-hidden="true"></i>{goals}</b>
            {isAdmin && (
              <span className="sc-stepper">
                <button type="button" onClick={() => setGoals((g) => Math.max(0, g - 1))} aria-label="Bớt 1 bàn" disabled={goals === 0}>-</button>
                <button type="button" onClick={() => setGoals((g) => g + 1)} aria-label="Thêm 1 bàn">+</button>
              </span>
            )}
          </div>
          <div className="sc-stat">
            <small>Quỹ {monthLabel(thisMonth).toLowerCase()}</small>
            <b className={!activeFund ? '' : paidThisMonth ? 'ok' : 'warn'}>{!activeFund ? '--' : paidThisMonth ? 'Đã đóng' : 'Chưa đóng'}</b>
            <span>{activeFund ? `${formatMoney(activeFund.fee)} · ${activeFund.name}` : 'Chưa có quỹ đang mở'}</span>
          </div>
          <div className="sc-stat">
            <small>Số trận đã đá</small>
            <b>{matchesPlayed}</b>
          </div>
        </div>

        {isAdmin && (
          <div className="sc-admin-fields">
            <div className="sc-span-2 sc-photo-field">
              <span className="sc-label">Ảnh đại diện</span>
              <div className="sc-row-gap">
                <button type="button" className="sc-btn small" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <i className={`bx ${uploading ? 'bx-loader-alt bx-spin' : 'bx-image-add'}`} aria-hidden="true"></i>
                  {uploading ? 'Đang tải lên' : 'Chọn ảnh từ máy'}
                </button>
                {avatar && (
                  <button type="button" className="sc-btn ghost small" disabled={uploading}
                    onClick={() => { setLink(''); setPhotoError(''); setAvatar(''); }}>
                    <i className="bx bx-trash" aria-hidden="true"></i>Xóa ảnh
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
              <div className="sc-shape-picker" role="radiogroup" aria-label="Khung ảnh đại diện">
                <span className="sc-label">Khung ảnh</span>
                {([['circle', 'Tròn'], ['rounded', 'Bo góc'], ['square', 'Vuông'], ['hex', 'Lục giác']] as const).map(([id, name]) => (
                  <button key={id} type="button" role="radio" aria-checked={shape === id} className={shape === id ? 'on' : ''} onClick={() => setShape(id)} title={name} aria-label={name}>
                    <span className={`sc-shape-chip ${id}`}></span><small>{name}</small>
                  </button>
                ))}
              </div>
              <label className="sc-link-field">
                <span>Hoặc dán link ảnh / link GIF từ Giphy</span>
                <input value={link} onChange={(e) => { setLink(e.target.value); setPhotoError(''); }} onBlur={applyLink} placeholder="https://..." maxLength={400} />
              </label>
              <button type="button" className="sc-btn ghost small sc-giphy" onClick={() => setGifFor(gifFor === 'avatar' ? '' : 'avatar')}>
                <i className="bx bx-search-alt" aria-hidden="true"></i>Tìm GIF
              </button>
              {gifFor === 'avatar' && <GifSearch onClose={() => setGifFor('')}
                onPick={(url) => { setLink(url); setAvatar(url); setPhotoError(''); setGifFor(''); }} />}
              {photoError && <small className="sc-error" role="alert">{photoError}</small>}
            </div>
            {!activeFund ? (
              <p className="sc-muted sc-span-2"><i className="bx bx-wallet" aria-hidden="true"></i> Chưa có quỹ nào đang mở. Tạo quỹ ở tab Quỹ để ghi nhận đóng quỹ.</p>
            ) : fundUnlocked ? (
              <button type="button" className={`sc-btn ${paidThisMonth ? 'ghost' : ''} sc-span-2`} onClick={() => onTogglePaid(member.id, thisMonth)}>
                <i className={`bx ${paidThisMonth ? 'bx-undo' : 'bx-check'}`} aria-hidden="true"></i>
                {paidThisMonth ? 'Đánh dấu chưa đóng' : 'Đánh dấu đã đóng quỹ'}
              </button>
            ) : (
              <p className="sc-muted sc-span-2"><i className="bx bx-lock-alt" aria-hidden="true"></i> Mở khóa quỹ ở tab Quỹ để cập nhật đóng quỹ.</p>
            )}
          </div>
        )}

        <div className="sc-ledger">
          <h3>Quỹ &amp; lịch sử đá</h3>
          <div className="sc-ledger-sum">
            <div>
              <small>Đã đóng quỹ</small>
              <b>{formatMoney(ledger.contributed)}</b>
              <span>{ledger.paidMonths.length} lượt đóng</span>
            </div>
            <div>
              <small>Chi phí các buổi đá</small>
              <b className="spent">{ledger.spent ? '-' : ''}{formatMoney(ledger.spent)}</b>
              <span>{ledger.history.length} buổi</span>
            </div>
            <div className={ledger.balance < 0 ? 'neg' : 'pos'}>
              <small>{ledger.balance < 0 ? 'Còn nợ' : 'Còn lại'}</small>
              <b>{formatMoney(Math.abs(ledger.balance))}</b>
              <span>{ledger.balance < 0 ? 'cần đóng thêm' : 'trong quỹ'}</span>
            </div>
          </div>
          {ledger.history.length ? (
            <ol className="sc-ledger-list">
              {ledger.history.map(({ match, share }) => {
                const d = new Date(match.date);
                const when = Number.isNaN(d.getTime()) ? match.date
                  : `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
                return (
                  <li key={match.id}>
                    <i className="bx bx-football" aria-hidden="true"></i>
                    <span className="sc-grow"><b>{when}</b><small>{match.location}</small></span>
                    <span className={share ? 'cost' : 'sc-muted'}>{share ? `-${formatMoney(share)}` : 'Chưa tính phí'}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="sc-muted">Chưa tham gia buổi đá nào. Điểm danh ở tab Lịch đá để lưu lịch sử.</p>
          )}
        </div>

        <div className="sc-history">
          <h3>Lịch sử đóng quỹ</h3>
          {paidMonths.length ? (
            <div className="sc-chips">{paidMonths.map((p) => <span key={`${p.fund.id}-${p.month}`} className="sc-chip ok" title={p.fund.name}>{monthLabel(p.month)} · {p.fund.name}</span>)}</div>
          ) : (
            <p className="sc-muted">Chưa có tháng nào được ghi nhận.</p>
          )}
        </div>

        {isAdmin && paidMonths.length > 0 && !fundUnlocked && (
          <p className="sc-muted sc-remove-hint">Thành viên này có lịch sử đóng quỹ, cần mở khóa quỹ để xóa.</p>
        )}
        {isAdmin && (paidMonths.length === 0 || fundUnlocked) && (
          <button type="button" className="sc-link-danger" onClick={() => {
            if (window.confirm(`Xóa ${member.name} khỏi nhóm? Lịch sử đóng quỹ và đội hình của người này cũng sẽ bị xóa.`)) onRemove(member.id);
          }}>
            <i className="bx bx-trash" aria-hidden="true"></i> Xóa thành viên
          </button>
        )}
        </div>

        {isAdmin && (
          <div className="sc-dialog-actions">
            <button type="button" className="sc-btn ghost" onClick={requestClose}>Hủy</button>
            <button type="button" className="sc-btn" onClick={save} disabled={uploading}>
              <i className="bx bx-save" aria-hidden="true"></i>Lưu
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="sc-confirm-layer" onMouseDown={(e) => { e.stopPropagation(); e.target === e.currentTarget && setConfirming(false); }}>
          <div className="sc-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sc-confirm-title">
            <i className="bx bx-error-circle" aria-hidden="true"></i>
            <h3 id="sc-confirm-title">Thoát mà chưa lưu?</h3>
            <p>Các thay đổi của {member.name} sẽ bị mất.</p>
            <div className="sc-confirm-actions">
              <button type="button" className="sc-btn ghost" autoFocus onClick={() => setConfirming(false)}>Tiếp tục sửa</button>
              <button type="button" className="sc-btn sc-btn-danger" onClick={() => onCloseRef.current()}>Bỏ thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDetail;
