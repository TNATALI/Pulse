import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { SlackPage } from './pages/Slack';
import { GitHubPage } from './pages/GitHub';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<GitHubPage />} />
        <Route path="/slack" element={<SlackPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
