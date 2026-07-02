/* Réciproque — Cloche de notifications, partagée par toutes les pages.
   Suppose qu'une variable `sb` (client Supabase) existe déjà quand ce
   script se charge : place <script src="notifications.js"></script>
   APRÈS le script qui crée `sb` dans chaque page. */

(function () {
  function initNotifs() {
    if (typeof sb === 'undefined') return;
    const container = document.getElementById('notif-wrap');
    if (!container) return;

    if (!document.getElementById('notif-styles')) {
      const style = document.createElement('style');
      style.id = 'notif-styles';
      style.textContent = `
        #notif-wrap{position:relative}
        .notif-bell{background:none;border:none;color:inherit;font-size:18px;cursor:pointer;padding:6px 8px;position:relative;line-height:1}
        .notif-dot{position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:50%;background:#E6A24C;border:1.5px solid #0C2E2A}
        .notif-panel{display:none;position:absolute;right:0;top:calc(100% + 8px);width:300px;max-height:380px;overflow-y:auto;background:#FFFFFF;border:1px solid #E4DCCE;border-radius:14px;box-shadow:0 12px 32px rgba(10,27,25,.18);z-index:50}
        .notif-panel.show{display:block}
        .notif-item{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:12px 14px;text-decoration:none;color:#1B2421;border-bottom:1px solid #EFE9DD;font-size:13px;line-height:1.4}
        .notif-item:last-child{border-bottom:none}
        .notif-item:hover{background:#F4EEE3}
        .notif-item.unread{background:rgba(230,162,76,.08)}
        .notif-item.unread .notif-msg{font-weight:600}
        .notif-date{font-size:11px;color:#5E6B66;white-space:nowrap;flex:none}
        .notif-empty{padding:20px 14px;text-align:center;color:#5E6B66;font-size:13px}
        .notif-clear{display:block;width:100%;text-align:center;background:none;border:none;padding:11px;font-size:12.5px;color:#114F47;font-weight:600;cursor:pointer;border-top:1px solid #E4DCCE}
        .notif-clear:hover{background:#F4EEE3}
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <button id="notif-bell-btn" class="notif-bell" aria-label="Notifications">🔔<span class="notif-dot" id="notif-dot" style="display:none"></span></button>
      <div class="notif-panel" id="notif-panel"></div>
    `;

    let currentUserId = null;

    async function charger() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { container.style.display = 'none'; return; }
      currentUserId = session.user.id;

      const { data } = await sb.from('notifications')
        .select('id, message, lien, lu, cree_le')
        .eq('user_id', currentUserId)
        .order('cree_le', { ascending: false })
        .limit(20);

      const items = data || [];
      const nonLues = items.filter(n => !n.lu).length;
      document.getElementById('notif-dot').style.display = nonLues ? 'block' : 'none';

      const panel = document.getElementById('notif-panel');
      if (!items.length) {
        panel.innerHTML = '<div class="notif-empty">Aucune notification pour le moment.</div>';
        return;
      }
      const dateStr = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      panel.innerHTML = items.map(n => `
        <a class="notif-item ${n.lu ? '' : 'unread'}" href="${n.lien || '#'}" data-id="${n.id}">
          <span class="notif-msg">${n.message}</span>
          <span class="notif-date">${dateStr(n.cree_le)}</span>
        </a>`).join('') + (nonLues ? '<button class="notif-clear" id="notif-clear">Tout marquer comme lu</button>' : '');

      panel.querySelectorAll('.notif-item').forEach(it => {
        it.addEventListener('click', () => {
          sb.from('notifications').update({ lu: true }).eq('id', it.dataset.id).then(() => {});
        });
      });
      const clearBtn = document.getElementById('notif-clear');
      if (clearBtn) clearBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await sb.from('notifications').update({ lu: true }).eq('user_id', currentUserId).eq('lu', false);
        charger();
      });
    }

    document.getElementById('notif-bell-btn').addEventListener('click', () => {
      document.getElementById('notif-panel').classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notif-wrap')) document.getElementById('notif-panel').classList.remove('show');
    });

    charger();
    // rafraîchit toutes les 60s pour capter les nouvelles notifications sans recharger la page
    setInterval(charger, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNotifs);
  else initNotifs();
})();
