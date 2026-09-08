/** Assignment checklist only. Never used to authorize a login by email. */
export const INITIAL_ROSTER = [
  {email:'callum@leodisme.com',assignment:'Admin'},
  ...['tom','ollie','jonny','russel'].map(name => ({email:`${name}@leodisme.com`,assignment:'Manager'})),
  ...['john','damien','graham.stephenson','bryony','tyler.parker'].map(name => ({email:`${name}@leodisme.com`,assignment:'Engineer.Electrical'})),
  ...['danny','anthony.dyson'].map(name => ({email:`${name}@leodisme.com`,assignment:'Engineer.HVAC'})),
  ...['chris','aidan','marcus','harvey.obrien'].map(name => ({email:`${name}@leodisme.com`,assignment:'Engineer.PH'})),
] as const;
