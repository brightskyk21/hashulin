let scoreChosen = false,
  reviewPhotos = [],
  reviewSaving = false,
  savedReview = null,
  composerSearch = [],
  composerSearchVersion = 0;

function updateScore() {
  const input = $('#score'),
    score = Number(input.value),
    b = band(score);
  $('#scoreValue').value = scoreChosen ? score.toFixed(1) : '—';
  $('#scoreEmoji').textContent = scoreChosen ? b[0] : '·';
  $('#scoreBig').style.color = scoreChosen ? b[2] : '#78827c';
  $('#scoreEmoji').style.left = ((score - 1) / 9) * 100 + '%';
  input.setAttribute(
    'aria-valuetext',
    scoreChosen ? score.toFixed(1) + '점, ' + b[1] : '점수 미선택',
  );
  input.setCustomValidity(scoreChosen ? '' : '점수를 선택해주세요.');
  $('#scorePrompt').hidden = scoreChosen;
}

function chooseScore() {
  scoreChosen = true;
  updateScore();
}

function clearReviewPhotos() {
  reviewPhotos.forEach((p) => URL.revokeObjectURL(p.url));
  reviewPhotos = [];
  $('#reviewPhotoFiles').value = '';
  renderReviewPhotos();
}

function renderReviewPhotos() {
  $('#reviewPhotoPreviews').innerHTML = reviewPhotos
    .map(
      (p, i) =>
        `<div><img src="${p.url}" alt="선택한 사진 ${i + 1}"><button type="button" data-remove-review-photo="${i}" aria-label="사진 ${i + 1} 제외" ${p.done ? 'disabled' : ''}>${p.done ? '완료' : '×'}</button></div>`,
    )
    .join('');
  $('#reviewPhotoLabel').textContent = reviewPhotos.length
    ? `사진 ${reviewPhotos.length}장`
    : '사진 추가';
}

function compose(visit = null) {
  if (!groupId) return showDialog('#groupDialog');
  $('#journalDialog').close();
  editing = visit;
  savedReview = null;
  reviewSaving = false;
  ++composerSearchVersion;
  const form = $('#reviewForm');
  form.reset();
  form.querySelectorAll('input,textarea,button').forEach((el) => (el.disabled = false));
  delete form.dataset.placeId;
  delete form.dataset.searchPlace;
  form.elements.placeName.readOnly = false;
  form.elements.address.readOnly = false;
  $('#composeSearchResults').replaceChildren();
  $('#reviewProgress').textContent = '';
  $('#saveReview').textContent = '저장';
  $('#reviewConflict').hidden = true;
  $('#scoreGuide').hidden = true;
  $('#scoreHelp').setAttribute('aria-expanded', 'false');
  $('#scoreHelp').textContent = '기준 보기';
  const mine = visit?.h_reviews.find((r) => r.author_id === session.user.id);
  $('#formTitle').textContent = visit ? `${visit.h_places.name} · 내 리뷰` : '리뷰 추가';
  $('#placeFields').hidden = !!visit;
  form.elements.placeName.required = !visit;
  form.elements.date.required = !visit;
  form.elements.date.value = visit?.visited_on || today();
  form.elements.date.max = today();
  scoreChosen = !!mine;
  form.elements.score.value = mine?.score ?? 5.5;
  form.elements.comment.value = mine?.comment || '';
  $('#places').innerHTML = workspace.places
    .map((p) => `<option value="${esc(p.name)}">${esc(p.road_address || p.address)}</option>`)
    .join('');
  clearReviewPhotos();
  $('#reviewPhotoSection').hidden = !!visit?.legacy;
  updateScore();
  showDialog('#reviewDialog');
}

async function submitReview(button) {
  if (reviewSaving) return;
  reviewSaving = true;
  const form = $('#reviewForm'),
    target = groupId,
    visit = editing;
  const controls = [...form.querySelectorAll('input,textarea,button')];
  const prior = controls.map((el) => el.disabled);
  controls.forEach((el) => (el.disabled = true));
  try {
    if (!savedReview) {
      if (!scoreChosen) throw new Error('점수를 선택해주세요.');
      const payload = {
        score: Number(form.elements.score.value),
        comment: form.elements.comment.value.trim(),
        version: visit?.h_reviews.find((r) => r.author_id === session.user.id)?.version ?? null,
      };
      if (!payload.comment) throw new Error('감상을 입력해주세요.');
      let id = visit?.id;
      if (visit?.legacy)
        await api(`/legacy/reviews/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...payload,
            expectedScore: Number(visit.legacy.score),
            expectedComment: visit.legacy.comment,
          }),
        });
      else if (visit)
        await api(`/visits/${id}/review`, { method: 'PUT', body: JSON.stringify(payload) });
      else {
        if (
          ownLegacyReview(
            archive,
            workspace.places,
            session.user.id,
            form.dataset.placeId,
            form.elements.date.value,
            form.elements.placeName.value,
            form.elements.address.value,
          )
        )
          throw new Error('이날 남긴 리뷰가 있습니다. 해당 리뷰에서 내 리뷰 수정을 선택해주세요.');
        if (form.dataset.searchPlace && !form.dataset.placeId) {
          const result = await api(`/groups/${target}/places`, {
            method: 'POST',
            body: JSON.stringify({ ...JSON.parse(form.dataset.searchPlace), status: 'visited' }),
          });
          form.dataset.placeId = result.id;
        }
        id = await api(
          form.dataset.placeId
            ? `/places/${form.dataset.placeId}/visits`
            : `/groups/${target}/visits`,
          {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              date: form.elements.date.value,
              placeName: form.elements.placeName.value.trim(),
              address: form.elements.address.value.trim(),
            }),
          },
        );
      }
      savedReview = { id, group: target, legacy: !!visit?.legacy };
    }
    for (const p of reviewPhotos.filter((p) => !p.done)) {
      $('#reviewProgress').textContent =
        `리뷰 저장됨 · 사진 ${reviewPhotos.filter((p) => p.done).length + 1}/${reviewPhotos.length} 올리는 중…`;
      const body = new FormData();
      body.append('photo', p.file);
      body.append('visitId', savedReview.id);
      body.append('uploadId', p.key);
      body.append('caption', '');
      await api(`/groups/${savedReview.group}/photos`, { method: 'POST', body });
      p.done = true;
      renderReviewPhotos();
    }
    const result = savedReview;
    clearReviewPhotos();
    savedReview = null;
    $('#reviewDialog').close();
    if (groupId === result.group) await refreshJournal(result.legacy);
    status('리뷰을 저장했습니다.');
  } catch (error) {
    if (error.status === 409 && !savedReview) $('#reviewConflict').hidden = false;
    $('#reviewProgress').textContent = savedReview
      ? '점수와 감상은 저장됐습니다. 남은 사진만 다시 올릴 수 있습니다.'
      : '';
    $('#saveReview').textContent = savedReview ? '남은 사진 다시 올리기' : '저장';
    status(error.message);
  } finally {
    reviewSaving = false;
    controls.forEach((el, i) => (el.disabled = savedReview ? el.id !== 'saveReview' : prior[i]));
  }
}

function reviewDirty() {
  if (reviewSaving) return true;
  if (savedReview) return reviewPhotos.some((p) => !p.done);
  const f = $('#reviewForm'),
    mine = editing?.h_reviews.find((r) => r.author_id === session?.user.id);
  return (
    (scoreChosen && Number(f.elements.score.value) !== Number(mine?.score)) ||
    f.elements.comment.value !== (mine?.comment || '') ||
    reviewPhotos.length > 0 ||
    (!editing && !!f.elements.placeName.value.trim())
  );
}

function initReviewsComposer() {
  $('#score').oninput = chooseScore;

  $('#score').onclick = chooseScore;

  $('#reviewPhotoFiles').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (
      reviewPhotos.length + files.length > 10 ||
      files.some(
        (f) =>
          f.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
      )
    )
      return status('사진은 최대 10장, 한 장당 8MB 이하의 JPG·PNG·WebP를 선택해주세요.');
    reviewPhotos.push(
      ...files.map((file) => ({
        file,
        key: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        done: false,
      })),
    );
    renderReviewPhotos();
  };

  $('#reviewPhotoPreviews').onclick = (e) => {
    const b = e.target.closest('[data-remove-review-photo]');
    if (!b || reviewSaving) return;
    const index = Number(b.dataset.removeReviewPhoto);
    URL.revokeObjectURL(reviewPhotos[index].url);
    reviewPhotos.splice(index, 1);
    renderReviewPhotos();
  };

  $('#reviewForm').elements.placeName.oninput = () => {
    const f = $('#reviewForm');
    delete f.dataset.placeId;
    delete f.dataset.searchPlace;
    ++composerSearchVersion;
  };

  $('#reviewForm').elements.placeName.onchange = () => {
    const f = $('#reviewForm'),
      matches = workspace.places.filter((p) => p.name === f.elements.placeName.value.trim());
    if (matches.length === 1) {
      f.dataset.placeId = matches[0].id;
      f.elements.address.value = matches[0].address;
    }
  };

  $('#reviewForm').elements.address.oninput = () => {
    delete $('#reviewForm').dataset.placeId;
    delete $('#reviewForm').dataset.searchPlace;
  };

  $('#composeSearch').onclick = () =>
    busy($('#composeSearch'), async () => {
      const target = groupId,
        version = ++composerSearchVersion,
        query = $('#reviewForm').elements.placeName.value.trim();
      if (!query) return status('장소 이름을 입력해주세요.');
      const items = await api('/search?group=' + target + '&query=' + encodeURIComponent(query));
      if (target !== groupId || version !== composerSearchVersion || !$('#reviewDialog').open)
        return;
      composerSearch = items;
      $('#composeSearchResults').innerHTML = items.length
        ? items
            .map(
              (p, i) =>
                `<button type="button" data-compose-place="${i}"><strong>${esc(p.name)}</strong><small>${esc(p.roadAddress || p.address)}</small></button>`,
            )
            .join('')
        : '<p class="note">검색 결과가 없습니다. 이름과 주소를 직접 입력해도 됩니다.</p>';
    });

  $('#composeSearchResults').onclick = (e) => {
    const b = e.target.closest('[data-compose-place]');
    if (!b) return;
    const p = composerSearch[Number(b.dataset.composePlace)],
      f = $('#reviewForm');
    f.elements.placeName.value = p.name;
    f.elements.address.value = p.address;
    f.dataset.searchPlace = JSON.stringify(p);
    delete f.dataset.placeId;
    $('#composeSearchResults').replaceChildren();
  };

  $('#reviewForm').onsubmit = (e) => {
    e.preventDefault();
    submitReview(e.submitter);
  };

  $('#reviewDialog').addEventListener('close', () => {
    ++composerSearchVersion;
    clearReviewPhotos();
    if (savedReview) {
      const legacy = savedReview.legacy;
      savedReview = null;
      refreshJournal(legacy).catch((e) => status(e.message));
    }
  });
}
