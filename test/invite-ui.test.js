const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  let scrolls = 0,
    selected = false,
    copied = '';
  const elements = Object.fromEntries(
    ['inviteBox', 'copyInvite', 'inviteLink', 'inviteHeading', 'inviteMessage', 'inviteCode'].map(
      (id) => [
        '#' + id,
        {
          hidden: true,
          disabled: false,
          value: '',
          textContent: '',
          scrollIntoView() {
            scrolls++;
          },
          focus() {},
          select() {
            selected = true;
          },
          setSelectionRange() {},
        },
      ],
    ),
  );
  const context = vm.createContext({
    $: (id) => elements[id],
    session: { user: { id: 'owner' } },
    groups: [{ id: 'g', name: 'My group' }],
    location: { origin: 'https://example.test' },
    api: async () => 'token',
    navigator: {
      clipboard: {
        writeText: async (v) => {
          copied = v;
        },
      },
    },
    busy: (_, fn) => fn(),
  });
  const s = fs.readFileSync(
    require('node:path').join(__dirname, '../src/client/groups/invites.js'),
    'utf8',
  );
  vm.runInContext(s, context);
  return {
    context,
    elements,
    get scrolls() {
      return scrolls;
    },
    get selected() {
      return selected;
    },
    get copied() {
      return copied;
    },
  };
}
test('created invitation is visible and scrolls into view with explicit copy feedback', async () => {
  const h = setup();
  await h.context.createInvite({ dataset: { invite: 'g' } });
  assert.equal(h.elements['#inviteBox'].hidden, false);
  assert.equal(h.elements['#copyInvite'].disabled, false);
  assert.equal(h.scrolls, 2);
  assert.equal(h.elements['#inviteLink'].value, 'https://example.test/v2/#invite=token');
  await h.context.copyInviteLink();
  assert.equal(h.copied, h.elements['#inviteLink'].value);
  assert.equal(h.elements['#copyInvite'].textContent, '복사 완료');
});
test('invitation errors stay next to the link; clipboard denial selects the address', async () => {
  const h = setup();
  h.context.api = async () => {
    throw new Error('failed');
  };
  await h.context.createInvite({ dataset: { invite: 'g' } });
  assert.equal(h.elements['#inviteMessage'].textContent, 'failed');
  assert.equal(h.elements['#copyInvite'].disabled, true);
  h.elements['#inviteLink'].value = 'https://example.test/v2/#invite=token';
  h.context.navigator.clipboard.writeText = async () => {
    throw new Error('denied');
  };
  await h.context.copyInviteLink();
  assert.equal(h.selected, true);
  assert.match(h.elements['#inviteMessage'].textContent, /길게 눌러/);
});
