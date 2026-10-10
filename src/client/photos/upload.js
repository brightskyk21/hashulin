function openUpload(place = '') {
  if (!groupId) return showDialog('#groupDialog');
  $('#uploadForm').reset();
  $('#uploadPlace').value = place;
  $('#uploadProgress').textContent = '';
  showDialog('#uploadDialog');
}

function initPhotosUpload() {
  $('#uploadPhotos').onclick = () => openUpload();

  $('#uploadForm').onsubmit = (e) => {
    e.preventDefault();
    const files = [...$('#photoFiles').files],
      target = groupId,
      placeId = $('#uploadPlace').value,
      caption = $('#uploadCaption').value.trim();
    if (files.length > 10 || files.some((f) => f.size > 8 * 1024 * 1024))
      return status('한 번에 10장, 한 장당 8MB 이하로 선택해주세요.');
    busy(e.submitter, async () => {
      let done = 0;
      for (const file of files) {
        const body = new FormData();
        body.append('photo', file);
        body.append('placeId', placeId);
        body.append('caption', caption);
        $('#uploadProgress').textContent = `${done + 1} / ${files.length} 올리는 중…`;
        try {
          await api(`/groups/${target}/photos`, { method: 'POST', body });
          done++;
        } catch (error) {
          $('#photoFiles').value = '';
          $('#uploadProgress').textContent =
            `${done}장 저장됨 · ${file.name}부터 실패했어요. 나머지 사진만 다시 선택해주세요.`;
          if (target === groupId) await refreshPhotos();
          throw error;
        }
      }
      $('#uploadDialog').close();
      if (target === groupId) await refreshPhotos();
      status(done + '장의 사진을 올렸습니다.');
    });
  };
}
