import 'dotenv/config';
import app from './app';

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
    console.log(`🚀 CodeMentor Backend API đang chạy tại http://localhost:${PORT}`);
});