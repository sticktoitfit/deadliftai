import { prescribeFullWeek } from "./lib/programming/periodization";

const logs = []; // empty logs
const rms = { squat: 400, bench: 300, deadlift: 500 };
const plan = prescribeFullWeek(rms, logs, 1, 12, 4, {
  recoveryProfile: "male",
  age: 30,
  weakPoints: { squat: "hole", bench: "mid", deadlift: "floor" }
});

console.log("=== WEEKLY PLAN ACCESSORIES ===");
plan.forEach((s, i) => {
  console.log(`Session ${i+1} (${s.lift}):`);
  s.movements.filter(m => m.type === "accessory").forEach(m => {
    console.log(`  - ${m.name}`);
  });
});
