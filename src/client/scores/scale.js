function band(s) {
  return s < 3
    ? ['🤢', '매우 불만족', '#9f302d']
    : s < 5
      ? ['😣', '불만족', '#98470f']
      : s < 6
        ? ['😐', '보통', '#756006']
        : s < 8
          ? ['😋', '대체로 만족', '#4b6b22']
          : ['⭐', '매우 만족', '#176540'];
}

function mapScoreTone(score) {
  return score == null
    ? 'unrated'
    : score < 3
      ? 'avoid'
      : score < 5
        ? 'poor'
        : score < 6
          ? 'okay'
          : score < 8
            ? 'good'
            : 'great';
}

function initScoresScale() {
  $('#scoreHelp').onclick = () => {
    const guide = $('#scoreGuide');
    guide.hidden = !guide.hidden;
    $('#scoreHelp').setAttribute('aria-expanded', String(!guide.hidden));
    $('#scoreHelp').textContent = guide.hidden ? '기준 보기' : '기준 닫기';
  };
}
