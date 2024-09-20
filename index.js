require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');

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

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// mexendo na tabela ALUNOS

const { validate } = require('joi');
const Joi = require('joi');
const cpf_cnpj = require('cpf_cnpj');
const pool = require('./database');

const alunoSchema = Joi.object({
    nome: Joi.string().required(),
    email: Joi.string().email(),
    dataNascimento: Joi.date().format('DD-MM-YYYY').required(),
    altura: Joi.string().precision(2).allow(null,''),
    peso: Joi.string().precision(2).allow(null,''),
    rg: Joi.string().custom((value, helpers) => {
        if (!cpf_cnpj.isValidRG(value)) {
            return helpers.message('RG Inválido');
        }
        return value;
    }).required(),
    cpf: Joi.string().custom((valuem, helpers) => {
        if (!cpf_cnpj.isValidCPF(value)) {
            return helpers.message('CPF Inválido');
        }
        return value;
    }).required(),
    nomeResponsavel: Joi.string(),
    endereco: Joi.string().allow(null,''),
    bairro: Joi.string().allow(null,''),
    cidade: Joi.string().allow(null,''),
    telefone: Joi.string().required(),
    situacao: Joi.string().required(),
    bolsita: Joi.boolean().required(),
    percentualBolsa: Joi.number().when('bolsita', { is: true, then: Joi.required()})
});

function handleError(error, res) {
    console.error(error);
    res.status(500).send('Erro ao processar requisição!');
}

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
    if (req.user.tipo !== 'admin'){ 
        return res.status(403).json({message: 'Acesso negado'});
    }

    const { error } = alunoSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        const [existingPlayer] = await pool.query('SELECT * FROM alunos WHERE cpf = ? OR rg = ?', [req.body.cpf, req.body.rg]);
        if (existingPlayer.length > 0) {
            return res.status(409).json({ message: 'CPF ou RG já cadastrado.'});
        }
        
        await pool.query('INSERT INTO alunos SET ?', [req.body]);
        res.json({ message : ' Aluno cadastrado com sucesso.'});
    } catch (error) {
        handleError(error, res);
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
    if (req.user.tipo !== 'admin'){ 
        return res.status(403).json({message: 'Acesso negado'});
    }

    const { error } = alunoSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    if (!nome || !rg || !telefone || !situacao || bolsista || percentualBolsa) {
        return res.status(400).json({message: ' Campos obrigatorios não preenchidos.'});
    }
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

// Sistema de verificação de login

app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;

    try {
        const [rows] = await pool.query('SELECT * FROM logins WHERE usuario = ?', [usuario]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Usuario não encontrado'});
        }

        if (user.senha !== senha) {
            return res.status(401).json({ message: 'Sneha incorreta!'});
        }

        if (user.tipo_usuario === 'admin') {
            const token = jwt.sign({ userId: user.id, tipo: 'admin'}, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });

        } else if (user.tipo_usuario === 'responsavel') {
            const token = jwt.sign({ userId: user.id, tipo: 'responsavel', alunoId: user.aluno_id }, process.env.JWT_SECRET, { expiresIn: '1h'});
            res.json({ token });

        } else {
            return res.status(400).json({ message: 'Tipo de usuario inválido!'});
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao realizar login');
    }
});


// Sistema para criação de senha

app.post('/usuarios/criar-senha', async (req, res) => {
    const { usuario, novaSenha } = req.body;

    try{
        const [rows] = await pool.query('SELECT * FROM logins WHERE usuario = ? AND tipo_usuario = "admin"', [usuario]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({message: 'Usuário não encontrado ou não é Admin'});
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(novaSenha, saltRounds);

        await pool.query('UPDATE logins SET senha = ? WHERE usuario = ?', [hashedPassword, usuario]);
        
        res.json({ message: 'Senha atualizada com sucesso!'});
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao atualizar senha')
    }
});