require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});


app.use(cors());
app.use(express.json());

function generateToken(user) {
    return jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function authMiddleware(req, res, next) {
    const authHeader = authMiddleware = req.headers['authorizarion'];
    const token = authHeader && authHeader.split('')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// mexendo na tabela ALUNOS

app.get('/alunos', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM alunos');
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Erro ao buscar alunos.');
    }
});

app.post('/alunos', async (req, res) => {
    try {
        const [result] = await pool.query('INSERT INTO alunos SET ?', [req.body]);
        res.json({message: 'Aluno cadastrado com sucesso!', id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao cadastrar aluno');
    }
});

app.get('/alunos/:id', async (req, res) => {
    const { id } = req.params;
    try{
        const [rows] = await pool.query('SELECT * FROM alunos WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).send('Aluno não encontrado');
        }
        res.json(rows[0]);
    } catch (error){
        console.error(error);
        res.status(500).send('Erro ao buscar aluno.')
    }
});

app.put('/alunos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM alunos WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).send('Aluno não encontrado');
        }
        res.json({message: 'Aluno atualizado com sucesso'});
    } catch (error){
        console.error(error);
        res.status(500).send('Erro ao atualizar aluno');
    }
});

app.delete('/aluno/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM alunos WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).send('Aluno não encontrado.');
        }
        res.json({message : 'Aluno deleteado com sucesso!'})
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao deletar aluno');
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});


 // Mexendo na tabela Pagamentos

// registrando um novo pagamento
app.post('/pagamentos', authMiddleware, async (req, res) => {
    const { alunoId, mes, ano, valorPago } = req.body;

    try {
        const [aluno] = await pool.query('SELECT valor_mensalidade FROM alunos WHERE id = ?', [alunoId]);

        if (!aluno.length) {
            return res.status(404).json({message: 'Aluno não encontrado.'});
        }

        const valorMensalidade = aluno[0].valor_mensalidade;

        await pool.query('INSERT INTO pagamentos SET ?', {
            alunoId,
            mes,
            ano,
            valorMensalidade,
            valorPago,
            pago : valorPago >= valorMensalidade
        });

        res.json({ message: 'Pagamento registrado com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao registrar pagemento');
    }
});

// todos os pagamentos de um aluno
app.get('/alunos/:alunoId/pagamentos', authMiddleware, async (req, res) => {
    const { alunoId } = req.params;

    try {
        const [rows] = await pool.query ('SELECT * FROM pagamentos WHERE alunoId = ?', [alunoId]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao buscar pagamento do aluno');
    }
});

// todos os pagamentos pendentes de um aluno
app.get('/alunos/:alunoId/pagamentos/pendentes', authMiddleware, async (req, res) => {
    const { alunoId } = req.params;

    try {
        const [rows] = await pool.query('SELECT * FROM pagamentos WHERE alunoId = ? and pago = 0', [alunoId]);
        res.json(rows)
    } catch (error) {
        console.error(error);
        res.status(500).send('Error ao buscar pagamentos pendentes do aluno');
    }
});

// Mexendo na tabela CFA

app.post('/alunos/:alunoId/cfa', authMiddleware, async (req, res) => {
    const { alunoId } = req.params;
    const { posicaoFavorita1, posicaoFavorita2, federado, ...rest } = req.body;

    try{
        const [aluno] = await pool.query('SELECT * FROM alunos WHERE id = ? AND situacao = "CFA"', [alunoId]);
        if (!aluno.length) {
            return res.status(404).json({ message: 'Aluno não encontrado ou não é da categoria CFA '});
        }

        await pool.query('INSERT INTO informacoes_adicionais_cfa SET ?', {
            alunoId,
            posicaoFavorita1,
            posicaoFavorita2,
            federado,
            ...rest
        });

        res.json({ message: 'Informações adicionais cadastradas com sucesso!'});
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao cadastrar informações adicionais');
    }
});

app.put('/alunos/:alunoId/cfa', authMiddleware, async (req, res) => {
    const { alunoId } = req.params;
    const { posicaoFavorita1, posicaoFavorita2, federado, ...rest } = req.body;

    try { 
        await pool.query('UPDATE infomacoes_adicionais_cfa SET ? WHERE alunoId = ?', [{
            posicaoFavorita1,
            posicaoFavorita2,
            federado,
            ...rest
        }, alunoId]);

        res.json({ message: 'Informações adicionadas com sucesso.'});
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao atualizar informações adicionais');
    }
});

app.get('/alunos/:alunoId/cfa', authMiddleware, async (req, res) => {
    const { alunoId } = req.params;

    try {
        const [rows] = await pool.query('SELECT * FROM infomacoes_adicionais_cfa WHERE alunoId = ?', [alunoId]);
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro aos buscar informações adicionais')
    }
})