function accountStep(profile, groups, invite) {
  return !profile ? 'profile' : invite ? 'invite' : !groups.length ? 'group' : 'ready';
}
