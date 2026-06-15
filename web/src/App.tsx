import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlayJoin } from './pages/PlayJoin';
import { PlayGame } from './pages/PlayGame';
import { HostLogin } from './pages/HostLogin';
import { HostDashboard } from './pages/HostDashboard';
import { QuizEditor } from './pages/QuizEditor';
import { HostGame } from './pages/HostGame';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayJoin />} />
        <Route path="/play/:pin" element={<PlayGame />} />
        <Route path="/host/login" element={<HostLogin />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/host/edit/:quizId" element={<QuizEditor />} />
        <Route path="/host/game/:pin" element={<HostGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
