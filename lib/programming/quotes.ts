/**
 * Powerlifting Quotes Registry
 * 
 * WHY: This file contains the curated list of motivational powerlifting cues
 * provided in the project resources. These are used in "liminal spaces" 
 * throughout the app to provide subtle, passive motivation.
 */

export const POWERLIFTING_QUOTES = [
  { text: "Everybody wants to be a bodybuilder, but nobody wants to lift no heavy-ass weights.", author: "Ronnie Coleman" },
  { text: "There is no reason to be alive if you can't do deadlift.", author: "Jón Páll Sigmarsson" },
  { text: "Strong people are harder to kill than weak people and more useful in general.", author: "Mark Rippetoe" },
  { text: "Weak things break.", author: "Louie Simmons" },
  { text: "You can't fake strong.", author: "Jim Wendler" },
  { text: "Gravity is just a suggestion.", author: "Anonymous" },
  { text: "Bend the bar, don't let it bend you.", author: "Anonymous" },
  { text: "Discipline over motivation.", author: "Jim Wendler" },
  { text: "Under the bar, we are all equal.", author: "Anonymous" },
  { text: "Chalk up and shut up.", author: "Anonymous" },
  { text: "The last three or four reps are what make the muscle grow.", author: "Arnold Schwarzenegger" },
  { text: "The deadlift… trains the mind to do things that are hard.", author: "Mark Rippetoe" },
  { text: "Any weight you make is better than any weight you miss.", author: "Greg Everett" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "If it doesn't challenge you, it doesn't change you.", author: "Fred DeVito" },
  { text: "Pain is temporary. Quitting lasts forever.", author: "Lance Armstrong" },
  { text: "Champions aren't made in gyms. Champions are made from something deep inside them.", author: "Muhammad Ali" },
  { text: "Discipline is doing what you hate to do, but doing it like you love it.", author: "Mike Tyson" },
  { text: "What hurts today makes you stronger tomorrow.", author: "Jay Cutler" },
  { text: "You have to think it before you can do it. The mind is what makes it all possible.", author: "Kai Greene" },
  { text: "It never gets easier, you just get stronger.", author: "Greg LeMond" },
  { text: "Train insane or remain the same.", author: "Jillian Michaels" },
  { text: "If you think lifting weights is dangerous, try being weak. Being weak is dangerous.", author: "Bret Contreras" },
  { text: "We must all suffer one of two things: the pain of discipline or the pain of regret.", author: "Jim Rohn" },
  { text: "Don't have $100 shoes and a 10 cent squat.", author: "Louie Simmons" },
  { text: "If you're capable of sending a legible text message between sets, you probably aren't working hard enough.", author: "Dave Tate" },
  { text: "When you hit failure, your workout has just begun.", author: "Ronnie Coleman" },
  { text: "Passion trumps everything.", author: "Dave Tate" },
  { text: "The only way to define your limits is by going beyond them.", author: "Unknown" },
  { text: "Most champions are built by punch-the-clock workouts rather than extraordinary efforts.", author: "Dan John" },
  { text: "Consistency is king.", author: "John Haack" },
  { text: "Focus on making consistent marginal improvements.", author: "John Haack" },
  { text: "Gravity doesn't sleep.", author: "Anonymous" },
  { text: "The bar is always the same weight. It's your mind that changes.", author: "Dave Tate" },
  { text: "If it was easy, everyone would do it.", author: "Anonymous" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Strong is not a destination. It's a way of being.", author: "Anonymous" },
  { text: "The platform is where you show what you've earned.", author: "Anonymous" },
  { text: "Quiet confidence is louder than screaming.", author: "Anonymous" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
];

/**
 * Gets a random quote from the registry.
 */
export function getRandomQuote() {
  const index = Math.floor(Math.random() * POWERLIFTING_QUOTES.length);
  return POWERLIFTING_QUOTES[index];
}
