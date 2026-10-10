function reviewCopy(review, source) {
  const id = `review-copy-${source}-${review.id}`;
  return `<div class="review-copy"><p id="${esc(id)}" class="review-comment">${esc(review.comment || '')}</p><button class="review-toggle" data-expand-review="${esc(id)}" aria-controls="${esc(id)}" aria-expanded="false" hidden>더보기</button></div>`;
}

let reviewClampFrame;

function scheduleReviewClamps() {
  observePhotos();
  cancelAnimationFrame(reviewClampFrame);
  reviewClampFrame = requestAnimationFrame(() => {
    document.querySelectorAll('.review-copy').forEach((copy) => {
      const paragraph = copy.querySelector('.review-comment'),
        button = copy.querySelector('.review-toggle');
      if (!paragraph.getClientRects().length) return;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      paragraph.classList.remove('is-expanded');
      const overflow = paragraph.scrollHeight > paragraph.clientHeight + 1;
      button.hidden = !overflow;
      const keepExpanded = expanded && overflow;
      paragraph.classList.toggle('is-expanded', keepExpanded);
      button.setAttribute('aria-expanded', String(keepExpanded));
      button.textContent = keepExpanded ? '접기' : '더보기';
    });
  });
}

let reviewLayoutWidth = 0;

function initReviewsCopy() {
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-expand-review]');
    if (!button) return;
    const paragraph = document.getElementById(button.dataset.expandReview);
    if (!paragraph) return;
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    paragraph.classList.toggle('is-expanded', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? '접기' : '더보기';
  });

  new ResizeObserver((entries) => {
    const width = entries[0].contentRect.width;
    if (width !== reviewLayoutWidth) {
      reviewLayoutWidth = width;
      scheduleReviewClamps();
    }
  }).observe($('#main'));

  if (document.fonts) document.fonts.ready.then(scheduleReviewClamps);
}
