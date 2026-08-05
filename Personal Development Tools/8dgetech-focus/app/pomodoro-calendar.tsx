import { Redirect } from 'expo-router';

/** Calendar is a modal on the timer screen — keep deep links on Pomodoro. */
export default function PomodoroCalendarRoute() {
  return <Redirect href="/pomodoro" />;
}
