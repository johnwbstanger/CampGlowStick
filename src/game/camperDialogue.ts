export const CAMPER_NAMES = ['Ben', 'Maya', 'Tommy', 'Katie', 'Nate', 'Jess', 'Luke'];

const LINES = [
  ['I knew somebody would eventually check behind here.', 'Please tell me we are not still doing capture the flag.', 'I heard something breathing and decided this was my house now.'],
  ['I was not hiding. I was strategically waiting.', 'The lake made a noise that lakes are not supposed to make.', 'Can we go to the bus now? Like, immediately?'],
  ['I found three marshmallows and a raccoon. The raccoon kept the marshmallows.', 'Counselor, I have several complaints.', 'That thing is absolutely not on the camp brochure.'],
  ['I would like it noted that I voted to stay in the cabin.', 'If we survive, I am calling my mom.', 'I heard screaming, but it might have been the arts-and-crafts cabin.'],
  ['Do I still get the merit badge for this?', 'I threw a mug at it. The mug did not win.', 'I have been quiet for, like, a personal record.'],
  ['There is a journal over there and I am pretty sure it is cursed.', 'Good news: I am alive. Bad news: everything else.', 'I am never going to summer camp again.'],
  ['Is the bus unlocked? Please say the bus is unlocked.', 'I saw it walk past twice. It has terrible vibes.', 'I think hiding under a picnic table counts as wilderness survival.'],
];

export function camperName(id: number): string { return CAMPER_NAMES[id % CAMPER_NAMES.length]; }
export function camperFoundLine(id: number): string {
  const lines = LINES[id % LINES.length];
  return lines[(id * 5 + 1) % lines.length];
}
