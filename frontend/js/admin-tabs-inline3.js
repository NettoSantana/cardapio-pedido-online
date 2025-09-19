// admin-tabs-inline3.js — força “Cardápio” abrir só o modal (sem navegar)
(function () {
  if (window.__cardapioWired) return;
  window.__cardapioWired = true;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function qAll(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  // já existe nosso modal injetado no HTML da página admin
  const modal = document.getElementById('cardapio-modal');

  function showModal() {
    if (!modal) return;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
  function hideModal() {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // fecha no X ou clicando no backdrop
  if (modal) {
    const closeBtn = modal.querySelector('.cpio-close');
    if (closeBtn && !closeBtn.__wired) {
      closeBtn.__wired = true;
      closeBtn.addEventListener('click', (e) => { e.preventDefault(); hideModal(); });
    }
    if (!modal.__backdropWired) {
      modal.__backdropWired = true;
      modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); }, true);
    }
    if (!modal.__escWired) {
      modal.__escWired = true;
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideModal(); }, true);
    }
  }

  function looksLikeCardapioButton(el) {
    if (!el) return false;
    const txt = (el.textContent || '').trim().toLowerCase();
    return (
      txt === 'cardápio' || txt === 'cardapio' ||
      el.id === 'btn-cardapio' ||
      el.dataset.cardapio === '1'
    );
  }

  function findCardapioButton() {
    // procura por <a> e <button> com o texto/ids acima
    const candidates = qAll('a,button');
    return candidates.find(looksLikeCardapioButton) || null;
  }

  function onClickOpenModal(e) {
    // bloqueia completamente a navegação/propagação
    if (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
    }
    showModal();
    return false;
  }

  function wireButton() {
    const btn = findCardapioButton();
    if (!btn || btn.__cardapioBound) return;

    // impede mousedown já disparar navegação em alguns browsers
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    }, { capture: true });

    btn.addEventListener('click', onClickOpenModal, { capture: true });
    btn.__cardapioBound = true;

    // se for <a>, mata o href para não navegar
    if (btn.tagName === 'A') {
      btn.dataset._oldHref = btn.getAttribute('href') || '';
      btn.setAttribute('href', '#');
      // evita middle-click abrir nova aba
      btn.setAttribute('rel', 'noopener');
    }
  }

  // roda agora e também re-amarra se a UI recarregar o topo
  wireButton();
  const obs = new MutationObserver(() => wireButton());
  obs.observe(document.body, { childList: true, subtree: true });
})();
