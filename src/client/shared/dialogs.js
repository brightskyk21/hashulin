function status(text) {
  $('#status').textContent = text;
  document.querySelectorAll('.dialog-status').forEach((x) => x.remove());
  const dialog = document.querySelector('dialog[open]');
  if (dialog && text) {
    const p = document.createElement('p');
    p.className = 'dialog-status note';
    p.setAttribute('role', 'status');
    p.textContent = text;
    dialog.append(p);
  }
  clearTimeout(status.timer);
  status.timer = setTimeout(() => ($('#status').textContent = ''), 8000);
}

async function busy(button, fn) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    status(e.message);
  } finally {
    button.disabled = false;
  }
}

function showDialog(id) {
  status('');
  const dialog = $(id);
  dialog.showModal();
  const title = dialog.querySelector('.dialog-head h2');
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}
