import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;

// 🔹 Criar variável para armazenar os dados do usuário
let dadosUsuarios = {}; // Armazena temporariamente os dados do usuário
let mensagemExpirada = null; // Armazena a mensagem quando o orçamento expira
let modoOrcamento = false;
let timeoutOrcamento = null; // Variável para armazenar o temporizador do orçamento
let tentativasServico = 0;


async function identificarServicoIA(mensagem) {
    const servicosExa = [
        "Cabeamento Estruturado",
        "Painéis de Telecomunicações",
        "CFTV",
        "Fibra Óptica",
        "Implantação de Sistemas",
        "Teleproteção Digital",
        "Automação",
        "Teleproteção Oplat",
        "Especificação Técnica",
        "WorkStatement",
        "Projeto Básico e Executivo",
        "Medição de Resistividade do Solo"
    ];

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: `Você é um assistente inteligente que ajuda clientes a escolherem serviços da EXA Engenharia. Seu objetivo é identificar o serviço correto baseado na mensagem do usuário. Se houver mais de uma opção possível, retorne uma lista de sugestões. 
                    
                    **Lista de serviços disponíveis:**
                    ${servicosExa.join(", ")}
                    
                    **Formato da resposta (JSON válido):**
                    {
                        "servicoConfirmado": "Nome do serviço" ou null,
                        "sugestoes": ["Opção 1", "Opção 2"] (se houver dúvida)
                    }
                    ` },
                    { role: "user", content: `O usuário digitou: "${mensagem}". Identifique o serviço correto baseado na lista disponível.` }
                ],
                max_tokens: 100,
                temperature: 0.3
            })
        });

        const data = await response.json();
        const respostaIA = JSON.parse(data.choices[0].message.content.trim());

        return respostaIA;
    } catch (error) {
        console.error("⚠️ Erro ao identificar serviço com IA:", error);
        return { servicoConfirmado: null, sugestoes: [] };
    }
}


// 🔹 Função para encerrar o modo orçamento se o tempo expirar
function encerrarModoOrcamentoPorTempo() {
    if (modoOrcamento) {
        modoOrcamento = false;
        dadosUsuarios = {}; // Reseta os dados do orçamento

        console.log("⏳ Tempo do orçamento expirado. Resetando para modo global.");

        return {
            resposta: "O tempo para preencher o orçamento expirou ⏳. Caso ainda precise, você pode solicitar novamente ou entrar em contato com a **EXA Engenharia** pelo 📞telefone (81) 99996-5585 ou **✉️e-mail contato@exaengenharia.com**.",
            perguntasDinamicas: [
                "Como posso solicitar um orçamento?",
                "Quais são os serviços oferecidos pela EXA?",
                "A EXA oferece suporte técnico?"
            ]
        };
    }
    return null;
}


// 🚀 Função para decidir se o chatbot deve gerar perguntas ou apenas responder
function decidirGerarPerguntas(mensagemUsuario) {
    const perguntasSimples = [
        "Quais serviços a EXA oferece?",
        "Qual o telefone da EXA Engenharia?",
        "Qual o e-mail da EXA Engenharia?",
        "Onde fica a EXA Engenharia?",
        "Qual o horário de atendimento da EXA?"
    ];

    return !perguntasSimples.includes(mensagemUsuario);
}

// 🔹 Função para traduzir os serviços para o idioma detectado
async function traduzirServicos(idiomaDetectado) {
    try {
        const servicosEmPortugues = `
        Cabeamento Estruturado, Painéis de Telecomunicações, CFTV, Fibra Óptica, Implantação de Sistemas, 
        Teleproteção Digital, Automação, Teleproteção Oplat, Especificação Técnica, WorkStatement, 
        Projeto Básico e Executivo, Medição de Resistividade do Solo.
        `;

        // 🔹 Requisição para a OpenAI traduzir os serviços
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: `Traduza a seguinte lista de serviços da EXA Engenharia para ${idiomaDetectado}, mantendo a formatação natural e sem explicações:` },
                    { role: 'user', content: servicosEmPortugues }
                ],
                max_tokens: 400,
                temperature: 0
            })
        });

        if (!response.ok) {
            console.error("❌ Erro ao traduzir serviços.");
            return servicosEmPortugues; // Se houver erro, retorna em português
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content.trim() || servicosEmPortugues;

    } catch (error) {
        console.error("❌ Erro ao traduzir serviços:", error);
        return servicosEmPortugues; // Se falhar, assume português
    }
}

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true, // SSL direto
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  

  

// 🔹 Função para enviar e-mail com os dados coletados
async function enviarEmail(dados) {

    // 🔎 Verifica o histórico antes de analisar
    console.log("🔍 Histórico antes da análise:", JSON.stringify(dados.historico, null, 2));

    // 🔹 Se o histórico estiver vazio, adicionamos uma mensagem padrão
    if (!dados.historico || dados.historico.length === 0) {
        console.warn("⚠️ Histórico vazio, enviando análise padrão.");
        dados.historico = [{ role: 'system', content: 'Histórico de conversa não disponível.' }];
    }

// 🔹 Gera o conteúdo do log da conversa
const logContent = dados.historico?.map(entry => {
    return `${entry.role.toUpperCase()}: ${entry.content}`;
  }).join("\n") || "Histórico indisponível.";
  
  // 🔹 Caminho para salvar temporariamente o arquivo de log
  const logPath = './conversa-log.txt';
  
  // 🔹 Escreve o arquivo localmente
  fs.writeFileSync(logPath, logContent);
  

    // 🔹 Geração do gráfico e análise
    const urlGrafico = await gerarGraficoEngajamento(dados.historico);
    const analise = await analisarConversaComIA(dados.historico);
    const mailOptions = {
        from: `"EXA Engenharia" <${process.env.EMAIL_USER}>`,
        to: "contato@exaengenharia.com",
        subject: "Novo Pedido de Orçamento | Análise Inteligente | EXA Engenharia",
        html: `
          <h2>📌 <strong>NOVO PEDIDO DE ORÇAMENTO</strong></h2>
          <hr>
          <p><strong>📞 Telefone:</strong> ${dados.telefone || "Não informado"}</p>
          <p><strong>📧 E-mail:</strong> ${dados.email || "Não informado"}</p>
          <p><strong>👤 Nome:</strong> ${dados.nome}</p>
          <p><strong>💬 Serviço:</strong> ${dados.servico || "Não informado"}</p>
          <p><strong>❓ Dúvida:</strong> ${dados.duvida || "Nenhuma dúvida adicional informada"}</p>
          <p><strong>📝 Resumo da conversa:</strong> ${dados.resumo || "Sem detalhes adicionais"}</p>
          <hr>
          <h3>📊 Análise do Cliente</h3>
          <ul>
              <li><strong>🔍 Perfil Identificado:</strong> ${analise.perfil || "Não identificado"}</li>
              <li><strong>📈 Nível de Engajamento:</strong> ${analise.engajamento || "Não definido"}</li>
              <li><strong>❓ Total de Dúvidas:</strong> ${analise.duvidas || 0}</li>
              <li><strong>🗣️ Linguagem:</strong> ${analise.linguagem || "Não identificado"}</li>
          </ul>
          <hr>
          <h3>📊 Gráfico de Engajamento:</h3>
          <img src="${urlGrafico}" alt="Gráfico de Engajamento" style="max-width: 100%; height: auto;">
          <hr>
          <p>📍 <em>Esta solicitação foi gerada automaticamente pelo ExaBot.</em></p>
        `,
        attachments: [
            {
              filename: "conversa-log.txt",
              path: "./conversa-log.txt"
            }
          ]
      };      

      await transporter.sendMail(mailOptions);

      // 🔹 Após o envio do e-mail, remove o arquivo temporário
      try {
          fs.unlinkSync("./conversa-log.txt");
          console.log("🧹 Arquivo de log removido com sucesso!");
      } catch (erroRemocao) {
          console.warn("⚠️ Não foi possível remover o arquivo de log:", erroRemocao);
      }
      }
      
  
// 🔹 Função para gerar um resumo inteligente da conversa usando a OpenAI
async function gerarResumoConversa(historico) {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "Resuma a conversa do usuário com o chatbot da EXA Engenharia de forma clara e objetiva. Destaque qual foi o interesse do usuário e sua dúvida principal." },
                    { 
                        role: "user", 
                        content: historico.map(m => `${m.role === 'user' ? 'Usuário' : 'ExaBot'}: ${m.content}`).join("\n") 
                      }
                      
                ],
                max_tokens: 400,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            console.error("❌ Erro ao gerar resumo com a OpenAI.");
            return "Resumo não disponível devido a um erro na API.";
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content.trim() || "Resumo não disponível.";
        
    } catch (error) {
        console.error("❌ Erro ao gerar resumo com a OpenAI:", error);
        return "Resumo não disponível.";
    }
}

async function analisarConversaComIA(historico) {
    if (!historico || historico.length === 0) {
      console.warn("⚠️ Histórico vazio, retornando análise padrão.");
      return {
        perfil: "Não analisado",
        engajamento: "Não definido",
        duvidas: "Não informado",
        linguagem: "Não identificado"
      };
    }
  
    const mensagensFormatadas = historico.map((m) => {
      return `${m.role === "user" ? "Usuário" : "ExaBot"}: ${m.content}`;
    }).join("\n");
  
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `
  Você é uma IA especialista em comportamento de clientes. Com base na conversa completa abaixo entre um cliente e um chatbot da EXA Engenharia, gere uma análise em formato JSON como este:
  
  {
    "perfil": "Leigo | Intermediário | Técnico",
    "engajamento": "1/10",
    "duvidas": 2,
    "linguagem": "Formal | Informal"
  }
  
  Considere a quantidade de perguntas feitas, se o cliente escreveu corretamente, se demonstrou domínio técnico, se pediu reunião ou orçamento. Seja preciso.
            `
            },
            {
              role: "user",
              content: mensagensFormatadas
            }
          ],
          max_tokens: 300,
          temperature: 0.5
        })
      });
  
      const data = await response.json();
      const textoResposta = data.choices?.[0]?.message?.content?.trim();
  
      // 🧠 Tenta fazer o parse do JSON retornado pela IA
      try {
        return JSON.parse(textoResposta);
      } catch (parseError) {
        console.error("❌ Erro ao analisar conversa com IA:", parseError);
        return {
          perfil: "Não analisado",
          engajamento: "Não definido",
          duvidas: "Não informado",
          linguagem: "Não identificado"
        };
      }
  
    } catch (error) {
      console.error("❌ Erro ao chamar OpenAI:", error);
      return {
        perfil: "Não analisado",
        engajamento: "Não definido",
        duvidas: "Não informado",
        linguagem: "Não identificado"
      };
    }
  }
  

// 🔹 Função para gerar gráfico de engajamento usando QuickChart
import QuickChart from "quickchart-js";

// 🔹 Função para gerar gráfico de engajamento usando QuickChart
async function gerarGraficoEngajamento(historico) {
    if (!historico || historico.length === 0) {
        console.warn("⚠️ Histórico vazio para o gráfico, retornando gráfico padrão.");
        historico = [{ role: 'system', content: 'Histórico de conversa não disponível.' }];
    }

    // 🧠 Obtém análise da IA
    const analise = await analisarConversaComIA(historico);

    // 🔍 Exibe no console o que foi detectado
    console.log("📊 Análise do Cliente (para o gráfico):", analise);

    // 🔹 Contabiliza os eventos na conversa
    const totalPerguntas = historico.filter(msg => msg.role === 'user').length;
    const totalRespostas = historico.filter(msg => msg.role === 'assistant').length;
    const solicitacoesOrcamento = historico.some(msg => msg.content.toLowerCase().includes("orçamento"));
    const interesseReuniao = historico.some(msg => msg.content.toLowerCase().includes("reunião"));

    // 🔹 Cria os dados do gráfico
    const dadosGrafico = {
        labels: ["Perguntas Feitas", "Respostas do Bot", "Solicitação de Orçamento", "Interesse em Reunião"],
        datasets: [{
            label: "Engajamento do Usuário",
            data: [totalPerguntas, totalRespostas, solicitacoesOrcamento ? 1 : 0, interesseReuniao ? 1 : 0],
            backgroundColor: ["#4CAF50", "#FFC107", "#2196F3", "#FF5722"]
        }]
    };

    // 🏗️ Configuração do Gráfico
    const chart = new QuickChart();
    chart.setConfig({
        type: 'bar',
        data: {
          labels: ['Engajamento', 'Dúvidas', 'Perfil Técnico'],
          datasets: [
            {
              label: 'Análise do Cliente',
              data: [
                parseInt(analise.engajamento?.split("/")[0]) || 0,
                parseInt(analise.duvidas) || 0,
                analise.perfil === "Técnico" ? 8 : (analise.perfil === "Intermediário" ? 5 : 2) // Escala de 0 a 10
              ],
              backgroundColor: ['#4CAF50', '#FFC107', '#2196F3']
            }
          ]
        },
        options: {
          title: {
            display: true,
            text: '📊 Análise Inteligente do Cliente - ExaBot'
          },
          legend: {
            display: false
          },
          scales: {
            yAxes: [{
              ticks: {
                beginAtZero: true,
                stepSize: 1,
                max: 10
              }
            }]
          }
        }
      });
    

    chart.setWidth(500).setHeight(300).setBackgroundColor('white');

    // 🔹 Retorna a URL do gráfico gerado
    return chart.getUrl();
}


        // 🔹 Endpoint principal do chatbot
        app.post('/chatbot', async (req, res) => {
        try {
        const { mensagem } = req.body;

        // 🔹 Se houver uma mensagem salva de expiração do orçamento, envia antes de processar qualquer outra coisa
        if (mensagemExpirada) {
            const respostaTemp = mensagemExpirada;
            mensagemExpirada = null;
        
            return res.json({
                resposta: respostaTemp.resposta,
                perguntasDinamicas: respostaTemp.perguntasDinamicas || []
            });
        }
        

// 🔹 Garante que o histórico está inicializado
if (!dadosUsuarios.historico) {
    dadosUsuarios.historico = [];
}


// 🔹 Salva a mensagem do usuário no histórico
if (modoOrcamento && mensagem.trim()) {
    dadosUsuarios.historico.push({ role: 'user', content: mensagem.trim() });
}


        // 🔹 Verifica se o usuário pediu um orçamento (mas só ativa se ainda não estiver no modo orçamento)
        const palavrasChaveOrcamento = /\b(orçamento|cotação|contratar|custo|preço|valor|quanto custa|quanto sai|quanto fica|quanto é|quanto seria|quero contratar|desejo orçamento)\b/i;
    if (!modoOrcamento && palavrasChaveOrcamento.test(mensagem)) {
    modoOrcamento = true; // Ativa o modo orçamento se ainda não estiver ativo

// 🔹 Inicia o temporizador de 3 minutos
if (timeoutOrcamento) clearTimeout(timeoutOrcamento); // Cancela temporizador anterior, se existir
timeoutOrcamento = setTimeout(() => {
    if (modoOrcamento) { // Verifica se ainda está no modo orçamento
        console.log("⏳ Tempo do orçamento expirado. Resetando para modo global.");
        
        modoOrcamento = false;
        dadosUsuarios = {}; // Reseta os dados do orçamento

        // 🔹 Salva a mensagem de expiração para ser enviada na próxima interação do usuário
        mensagemExpirada = {
            resposta: "O tempo para preencher o orçamento **expirou** ⏳. Caso ainda precise, você pode **solicitar novamente** ou **entrar em contato** com a **EXA Engenharia** pelo 📞telefone (81) 99996-5585 ou **✉️e-mail contato@exaengenharia.com**.",
            perguntasDinamicas: [
                "Como posso solicitar um orçamento?",
                "Quais são os serviços oferecidos pela EXA?",
                "A EXA oferece suporte técnico?"
            ]
        };
    }
}, 240000); // 4 minutos (240.000 ms)


    return res.json({
        resposta: "**Para oferecer um atendimento mais eficiente**, podemos solicitar seus **dados** para um **especialista** entrar em contato com você. **Podemos continuar**?",
        perguntasDinamicas: ["Sim", "Não"]
    });
}

if (modoOrcamento && !dadosUsuarios.nome && mensagem.toLowerCase() === "não") {
    modoOrcamento = false;
    
    return res.json({
        resposta: "**Sem problemas!** Caso precise, você pode entrar em contato com a **EXA Engenharia** pelo 📞**telefone (81) 99996-5585** ou **✉️e-mail contato@exaengenharia.com**. **Posso te ajudar com algo mais?**",
        perguntasDinamicas: ["Sim", "Não"]
    });
}

// 🔹 Se o usuário responder "Sim", reinicia a conversa normalmente
if (!modoOrcamento && mensagem.toLowerCase() === "sim") {
    return res.json({
        resposta: "Ótimo! Escolha uma pergunta abaixo ou digite a sua.",
        perguntasDinamicas: [
            "Como posso solicitar um orçamento?",
            "Quais são os serviços oferecidos pela EXA?",
            "Qual é a missão da EXA?"
        ]
    });
}

// 🔹 Se o usuário responder "Não", finaliza a conversa educadamente
if (!modoOrcamento && mensagem.toLowerCase() === "não") {
    return res.json({
        resposta: "Tudo bem! Se precisar de algo no futuro, estarei por aqui. 😊"
    });
}


        

        // 🔹 Verifica a resposta do usuário para a pergunta sobre solicitar contato
if (mensagem.toLowerCase() === "sim") {
    // 🔹 Antes de pedir telefone/e-mail, o chatbot exibe os serviços da EXA
    if (!dadosUsuarios.servicoSelecionado) {
        return res.json({
            resposta: "Antes de prosseguirmos, **selecione** qual **serviço da EXA Engenharia** você deseja **orçamento**?",
            perguntasDinamicas: [
                "Cabeamento Estruturado",
                "Painéis de Telecomunicações",
                "CFTV",
                "Fibra Óptica",
                "Implantação de Sistemas",
                "Teleproteção Digital",
                "Automação",
                "Teleproteção Oplat",
                "Especificação Técnica",
                "WorkStatement",
                "Projeto Básico e Executivo",
                "Medição de Resistividade do Solo"
            ]
        });
    }
}


// 🔹 Lista de serviços da EXA que podem ser reconhecidos no modo orçamento
if (modoOrcamento && !dadosUsuarios.servicoSelecionado) {
    const respostaIA = await identificarServicoIA(mensagem);

    if (respostaIA.servicoConfirmado) {
        dadosUsuarios.servicoSelecionado = respostaIA.servicoConfirmado;
        tentativasServico = 0; // ✅ Reseta as tentativas quando um serviço é escolhido corretamente

        return res.json({
            resposta: `Ótima escolha! O serviço **${dadosUsuarios.servicoSelecionado}** foi selecionado para o orçamento. Agora, para dar continuidade, poderia me informar seu **telefone com (DDD)** ou **e-mail**?`,
            perguntasDinamicas: []
        });
    }

    if (respostaIA.sugestoes.length > 0) {
        return res.json({
            resposta: `Não encontrei um serviço exato, mas encontrei essas **opções** que podem ser o que você procura. Qual delas você deseja selecionar?`,
            perguntasDinamicas: respostaIA.sugestoes
        });
    }

    // 🔹 Se o usuário continuar digitando serviços errados, incrementar as tentativas
    tentativasServico++; // ✅ Agora o contador de tentativas é atualizado corretamente

    if (tentativasServico >= 3) {
        tentativasServico = 0; // ✅ Reseta o contador para evitar bloqueios futuros
        modoOrcamento = false; // ✅ Sai do modo orçamento

        return res.json({
            resposta: "Parece que você está tendo dificuldades em escolher um serviço. Caso precise de ajuda, entre em contato com a **EXA Engenharia** pelo 📞telefone (81) 99996-5585 ou **✉️e-mail contato@exaengenharia.com**.",
            perguntasDinamicas: [
                "Como posso solicitar um orçamento?",
                "Quais são os serviços oferecidos pela EXA?",

                "Vocês trabalham com projetos de subestações de energia?"
            ]
        });
    }

    return res.json({
        resposta: `Desculpe, não reconheci esse serviço. Por favor, escolha um dos serviços disponíveis abaixo:`,
        perguntasDinamicas: [
            "Cabeamento Estruturado",
            "Painéis de Telecomunicações",
            "CFTV",
            "Fibra Óptica",
            "Implantação de Sistemas",
            "Teleproteção Digital",
            "Automação",
            "Teleproteção Oplat",
            "Especificação Técnica",
            "WorkStatement",
            "Projeto Básico e Executivo",
            "Medição de Resistividade do Solo"
        ]
    });
}



// Resposta global para "não" apenas se não estivermos no modo orçamento:
if (!modoOrcamento && mensagem.toLowerCase() === "não") {
    modoOrcamentoIA = false; // 🔹 Desativa a IA após a escolha do serviço

    return res.json({
        resposta: "Sem problemas! Caso precise, você pode entrar em contato com a EXA Engenharia pelo 📞telefone (81) 99996-5585 ou ✉️e-mail contato@exaengenharia.com. Obrigado!😀",
        perguntasDinamicas: []
    });
}



// 🔹 Validação dinâmica de telefone: aceita formatos variados com ou sem (), -, espaço
const regexTelefone = /^(\(?\d{2}\)?[\s-]?)?\d{4,5}[-\s]?\d{4}$/;

// 🔹 Validação de e-mail: exige um formato correto
const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// 🔹 Validação do nome: impede números e caracteres inválidos
const regexNome = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?: [A-Za-zÀ-ÖØ-öø-ÿ]+)+$/;


// 🔹 Verifica se a mensagem contém um telefone válido
const matchTelefone = mensagem.match(regexTelefone);
if (matchTelefone && !mensagem.includes("@")) { // Garante que não seja um e-mail
    const telefoneFormatado = mensagem.replace(/\D/g, ""); // Remove caracteres não numéricos

    if (telefoneFormatado.length === 11) { // Confirma que tem 11 dígitos (DDD + número)
        dadosUsuarios.telefone = telefoneFormatado;
        return res.json({
            resposta: "Agora, por favor, informe seu nome. 😊",
            perguntasDinamicas: []
        });
    } else {
        return res.json({
            resposta: "❌ O número informado não parece ser válido. Poderia informar um telefone com **DDD** correto? Exemplo: (99) 99999-9999 📱",
            perguntasDinamicas: []
        });
    }
}

// 🔹 Verifica se o bot está esperando um telefone e a mensagem é um número solto
if (
    modoOrcamento &&
    !dadosUsuarios.telefone &&
    !dadosUsuarios.email &&
    dadosUsuarios.estado !== "NOME_COLETA" &&
    regexTelefone.test(mensagem.trim()) === false &&
    /\d+/.test(mensagem)
  ) {
      return res.json({
          resposta: "❌ Esse telefone não parece válido. Poderia informar um número com **DDD** correto? Exemplo: (99) 99999-9999 📱",
          perguntasDinamicas: []
      });
  }
  

// 🔹 Lista de mensagens irrelevantes dentro do orçamento
const mensagensIrrelevantes = ["sim", "não", "ok", "entendi", "talvez", "acho que sim", "acho que não"];

// 🔹 Se estivermos no modo orçamento e o usuário enviar algo irrelevante quando esperávamos telefone ou e-mail
if (modoOrcamento && !dadosUsuarios.telefone && !dadosUsuarios.email && mensagensIrrelevantes.includes(mensagem.toLowerCase())) {
    // Contabiliza tentativas erradas
    dadosUsuarios.erros = (dadosUsuarios.erros || 0) + 1;

    // Se o usuário insistir em respostas erradas 3 vezes, reseta o fluxo
    if (dadosUsuarios.erros >= 3) {
        modoOrcamento = false;
        dadosUsuarios = {}; // Resetar os dados para evitar confusão
        return res.json({
            resposta: "Parece que houve um **erro no preenchimento dos dados**. Se precisar, você pode solicitar um **orçamento novamente**! Caso prefira, entre em contato pelo 📞 **telefone: (81) 99996-5585** ou ✉️ **e-mail: contato@exaengenharia.com.**",
            perguntasDinamicas: ["Como posso solicitar um orçamento?", "Quais são os serviços oferecidos pela EXA?", "A EXA oferece suporte técnico?"]
        });
    }

    return res.json({
        resposta: "Não entendi sua resposta. Por favor, informe seu **telefone com (DDD)** ou **e-mail** para dar continuidade ao orçamento.",
        perguntasDinamicas: []
    });
}



// 🔹 Verifica se a mensagem contém um e-mail válido
if (regexEmail.test(mensagem.trim())) {
    dadosUsuarios.email = mensagem.trim(); // Salva o e-mail corretamente
    return res.json({
        resposta: "Agora, por favor, informe seu nome. 😊",
        perguntasDinamicas: []
    });
} else if (mensagem.includes("@")) {
    return res.json({
        resposta: "❌ Esse e-mail não parece válido. Poderia informar novamente? Exemplo: usuario@email.com 📧",
        perguntasDinamicas: []
    });
}

// Se o usuário já informou telefone ou e-mail, vamos tratar a coleta do nome e da dúvida (no modo orçamento)
if (modoOrcamento && (dadosUsuarios.telefone || dadosUsuarios.email)) {
    // Se ainda não coletamos o nome e não há estado definido, trata como etapa de nome
    if (!dadosUsuarios.nome && !dadosUsuarios.estado) {
      const nomeValido = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,}$/.test(mensagem.trim());
      if (nomeValido) {
        dadosUsuarios.nome = mensagem.trim();
        // Define o estado para indicar que o nome foi coletado
        dadosUsuarios.estado = "NOME_COLETA";
        return res.json({
          resposta: `Obrigado, **${dadosUsuarios.nome}**! Antes de **finalizar o atendimento**, Deseja adicionar alguma **dúvida** ou **solicitação específica** sobre **${dadosUsuarios.servicoSelecionado}** para nossa equipe de **especialistas**?`,
          perguntasDinamicas: ["Sim", "Não"]
        });
      } else {
        return res.json({
          resposta: "❌ Esse **nome** não parece válido. Por favor, informe um nome correto sem caracteres especiais. Exemplo: **José** ou **José Rodrigues**.",
          perguntasDinamicas: []
        });
      }
    }
    
    // Se já coletamos o nome (estado "NOME_COLETA"), interpretamos a resposta à pergunta de dúvida
    if (dadosUsuarios.estado === "NOME_COLETA") {
      if (mensagem.toLowerCase() === "sim") {
        // Muda para estado aguardando a dúvida
        dadosUsuarios.estado = "DUVIDA_PENDING";
        return res.json({
          resposta: "**Ótimo!** Por favor, informe sua **dúvida** ou **solicitação específica** sobre **" + dadosUsuarios.servicoSelecionado + "**:",
          perguntasDinamicas: []
        });
      } else if (mensagem.toLowerCase() === "não") {
        // Se o usuário responder "não", usamos dúvida padrão e avançamos
        dadosUsuarios.duvida = "Nenhuma dúvida adicional informada.";
        dadosUsuarios.estado = "DUVIDA_DONE";
      } else {
        // Se o usuário digitar algo diferente (tendo dado uma resposta que não é "sim" nem "não"),
        // interpretamos esse texto como a dúvida.
        dadosUsuarios.duvida = mensagem.trim();
        dadosUsuarios.estado = "DUVIDA_DONE";
      }
    }
    
    // Se o estado já estiver em "DUVIDA_PENDING" (caso o usuário forneça o texto da dúvida)
    if (dadosUsuarios.estado === "DUVIDA_PENDING") {

        dadosUsuarios.duvida = mensagem.trim();
      
        // 🔹 Salva a dúvida no histórico como mensagem do usuário
        if (modoOrcamento && mensagem.trim()) {
            dadosUsuarios.historico.push({ role: 'user', content: mensagem.trim() });
          }
          
      
        dadosUsuarios.estado = "DUVIDA_DONE";
      }
      
    
    // Quando o estado é "DUVIDA_DONE", envia o e-mail com os dados coletados e reseta o fluxo
if (dadosUsuarios.estado === "DUVIDA_DONE") {
     
    // 🔹 Cancela o temporizador quando o usuário finaliza o orçamento
    if (timeoutOrcamento) clearTimeout(timeoutOrcamento); 
    timeoutOrcamento = null; // Remove a referência ao temporizador
    console.log("✅ Orçamento finalizado. Temporizador cancelado.");

    console.log("📌 Dados do e-mail:");
    console.log(`Nome: ${dadosUsuarios.nome}`);
    console.log(`Telefone: ${dadosUsuarios.telefone || "Não informado"}`);
    console.log(`Email: ${dadosUsuarios.email || "Não informado"}`);
    console.log(`Serviço: ${dadosUsuarios.servicoSelecionado || "Não informado"}`);
    console.log(`Dúvida: ${dadosUsuarios.duvida || "Nenhuma dúvida adicional informada."}`);

    
      const nomeTemp = dadosUsuarios.nome;
      const telefoneTemp = dadosUsuarios.telefone || "Não informado";
      const emailTemp = dadosUsuarios.email || "Não informado";
      const servicoTemp = dadosUsuarios.servicoSelecionado || "Não informado";
      const duvidaTemp = dadosUsuarios.duvida || "Nenhuma dúvida adicional informada.";
    
      const resumoConversa = await gerarResumoConversa(dadosUsuarios.historico || []);
      console.log("📌 Resumo gerado pela OpenAI:");
      console.log(resumoConversa);
    
      try {
        console.log("📤 Enviando e-mail...");
        await enviarEmail({ 

            nome: nomeTemp, 
            telefone: telefoneTemp,
            email: emailTemp,
            servico: servicoTemp,
            duvida: duvidaTemp,
            resumo: resumoConversa,
            historico: dadosUsuarios.historico // ✅ Adiciona o histórico completo
          });
          
        console.log("✅ E-mail enviado com sucesso!");
      } catch (error) {
        console.error("❌ Erro ao enviar o e-mail:", error);
        return res.json({
          resposta: "⚠️ Ocorreu um erro ao enviar seu pedido de orçamento. Nossa equipe foi notificada e resolveremos isso em breve. Enquanto isso, posso te ajudar com mais alguma dúvida?",
          perguntasDinamicas: ["Quais serviços a EXA oferece?", "Qual seria o portfólio da EXA?", "Como faço para contratar um serviço?"]
        });
      }
      
      // Resetar os dados e voltar ao modo normal

      dadosUsuarios.historico = [];
      dadosUsuarios = {};
      modoOrcamento = false;
      return res.json({
        resposta: `✅ Obrigado, **${nomeTemp}**! Sua solicitação para **${servicoTemp}** foi **registrada** e encaminhada para nossa equipe. Em breve **entraremos em contato**. Se precisar de mais alguma coisa, estou à disposição!`,
        perguntasDinamicas: ["Quais serviços a EXA oferece?", "Qual seria o portfólio da EXA?", "Como faço para contratar um serviço?"]
      });
    }
  }
  



// 🔹 Função para chamar a API da OpenAI e obter respostas mais inteligentes
async function chamarOpenAI(mensagem) {
    const openAIResponse = await fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: mensagem }],
            max_tokens: 150
        })
    });

    const data = await openAIResponse.json();
    return data.choices[0]?.message?.content || "Desculpe, não consegui entender sua pergunta.";
}




        // 🔹 Detecta o idioma antes de enviar a requisição principal
        const idiomaDetectado = await detectarIdioma(mensagem);
        console.log(`🔹 Idioma detectado: ${idiomaDetectado}`);

        // 🔹 Tradução dinâmica da lista de serviços
        const servicosTraduzidos = await traduzirServicos(idiomaDetectado);

        // 🔹 Prompt atualizado com suas diretrizes
        const prompt = `
- Você é o ExaBot, assistente virtual da **EXA Engenharia**.
- **Responda sempre no idioma detectado: **${idiomaDetectado}**.
- **Sempre que mencionar os serviços, use a versão traduzida: **${servicosTraduzidos}**.
- **Sempre responda suas próprias perguntas**. Se você sugeriu uma pergunta, responda ela com informações relevantes.
- **Responda de forma objetiva e profissional**, garantindo que todas as respostas tenham uma explicação válida.
- **Se não tiver certeza absoluta de uma resposta, direcione o usuário aos especialistas da EXA**.
- **Evite respostas como "não sei" ou "não posso responder"**. Sempre forneça uma explicação ou um encaminhamento.

✅ **INSTRUÇÃO FIXA SOBRE HORÁRIOS:**  
    Se o usuário perguntar sobre os horários de atendimento da EXA Engenharia, **sempre** responda:  
    "Os horários de atendimento da **EXA Engenharia** são de **segunda a sexta-feira, das 8h às 17h**."
    
    **Agora, responda na língua do usuário:**

### EXEMPLOS:
1️⃣ **Pergunta:** "Quais são os passos para a elaboração de um Projeto Básico?"  
✅ **Resposta correta:** "A elaboração de um **Projeto Básico** envolve diversas etapas, como levantamento de requisitos, estudos técnicos, definição de materiais e validação de normas. Para mais detalhes, nossos especialistas podem ajudar. 📞 (81) 99996-5585 ✉️ contato@exaengenharia.com"

2️⃣ **Pergunta:** "Quais equipamentos são usados no CFTV?"  
✅ **Resposta correta:** "Os equipamentos mais utilizados no **CFTV** incluem: NVR, DVR, Câmeras Bullet, Câmeras PTZ, Switches e infraestrutura de rede. O equipamento ideal pode variar conforme a necessidade do projeto."

3️⃣ **Pergunta:** "Como posso solicitar um orçamento?"  
✅ **Resposta correta:** "Você pode solicitar um orçamento pelo telefone 📞 (81) 99996-5585 ou pelo e-mail ✉️ contato@exaengenharia.com.

📌 Diretrizes Gerais
✅ Respostas sempre dentro do escopo

Se a pergunta for sobre os serviços oferecidos, **NÃO** gere perguntas clicáveis.
            Em vez disso, finalize a resposta com:
            "Digite qual serviço acima você gostaria de saber mais, e eu explico em detalhes!"
            Nunca gere respostas fora do JSON puro.

O ExaBot não responde perguntas que não sejam sobre a EXA Engenharia.
Se o usuário insistir em perguntas fora do tema, ele responderá:
"Desculpe, só posso responder perguntas relacionadas à EXA Engenharia e seus serviços. Se precisar de algo específico, estou à disposição!"
Exceção para saudações e despedidas, que devem ser respondidas de forma natural.
✅ Estilo da resposta

Responder de forma direta, objetiva e profissional.
Adaptar a resposta ao contexto da conversa, sem ser robótico.
Utilizar negrito para destacar informações importantes, como:
Nome da empresa: EXA Engenharia
Nomes de serviços oferecidos
Clientes importantes, como CHESF e ENIND
Contatos oficiais (telefone, e-mail, site)
✅ Incentivar a exploração do site

O ExaBot pode sugerir que o usuário explore o site, fazendo perguntas como:
"Você gostaria de conhecer nosso portfólio de projetos?"
"Quer saber mais sobre os serviços que oferecemos?"
✅ Direcionamento ao final da conversa

Sempre que o usuário já tiver recebido informações suficientes, o ExaBot sugerirá o contato humano, informando:
"Se precisar de mais informações ou quiser um atendimento mais completo, você pode entrar em contato com nossos especialistas:
📞 **Telefone: (81) 99996-5585**
✉️ **E-mail: contato@exaengenharia.com**
📍 **Endereço: R. Cel. Alberto Lundgren, 190 - Bairro Novo, Olinda - PE**
Estou sempre à disposição!"
📌 Respostas sobre a EXA Engenharia
obs: Os números de contatos, email e endereço devem ser em negrito para destacar a visibilidade do usuário.
🔹 Quando perguntarem "Quem é a EXA?" ou variações, responder com:

Sobre a EXA Engenharia:
"Se perguntarem "Quem é a EXA?" exa, ou Exa, Qual a missão d EXA, "Quem é a EXA Engenharia?" ou variações dependendo do contexro sobre a "Exa, exa, EXA", responda com criatividade e naturalidade, abordando os seguintes pontos em suas próprias palavras referente a a toda diretriz:
 A EXA Engenharia foi fundada em 2021.
 É especializada em soluções no setor energético e Telecomunicações inovadoras.
 Atua com transparência, integridade e foco total no cliente.
 Sua equipe é composta por profissionais altamente qualificados, que são o ativo mais valioso da empresa.
 Os valores da EXA incluem confiança, segurança e solidez nos projetos e no atendimento.
 Resuma, varie as palavras e adapte ao contexto da conversa. Evite repetir a mesma resposta."

🔹 Quando perguntarem sobre serviços, o ExaBot responderá com a lista completa e destacará os serviços em negrito:

 A EXA Engenharia oferece os seguintes serviços:

• **Cabeamento Estruturado**
• **Painéis de Telecomunicações**
• **CFTV**
• **Fibra Óptica**
• **Implantação de Sistemas**
• **Teleproteção Digital**
• **Automação**
• **Teleproteção Oplat**
• **Especificação Técnica**
• **WorkStatement**
• **Projeto Básico e Executivo**
• **Medição de Resistividade do Solo**

**Digite qual serviço acima você gostaria de saber mais, e eu explico em detalhes!**

 // 🔹 Responder sobre equipamentos utilizados nos serviços da EXA Engenharia
Se perguntarem sobre equipamentos utilizados em um serviço específico, responda mencionando os principais equipamentos relacionados. 
Por exemplo:
- **CFTV**: NVR, DVR, Câmeras Bullet, Câmeras PTZ, Switches, Infraestrutura de Rede.
- **Cabeamento Estruturado**: Cabos UTP, Patch Panel, Racks, Switches, Patch Cords, Organizadores de Cabos.
- **Fibra Óptica**: Cabos OPGW, Fusões Ópticas, Conectores SC/LC, Switches Ópticos.
- **Automação**: Controladores Lógicos Programáveis (CLPs), Sensores, Atuadores.
Se não tiver certeza sobre a necessidade do cliente, informe que a escolha dos equipamentos pode depender da infraestrutura e das necessidades do projeto. 
Oriente o usuário a entrar em contato com um especialista da **EXA Engenharia** para uma análise mais detalhada:
📞 **Telefone**: (81) 99996-5585
✉️ **E-mail**: contato@exaengenharia.com

Caso o usuário peça detalhes sobre um serviço, a explicação será fornecida de forma detalhada.

🔹 Quando perguntarem sobre o portfólio, ele destacará alguns projetos e informará que mais detalhes estão disponíveis no site da EXA:

📌 Projetos em destaque:

BRE-CHESF-SE LAGOA DO CARRO: Atualização do Sistema de Teleproteção.
ENIND-CANADIAN-SE MARANGATU: Projeto Básico do Sistema de Telecomunicação.
BRE-SE DIAS MACEDO II: Projeto Básico de Sistemas de Telecomunicações.
DOM PEDRO II-CHESF-SE CRATO II-TAF: Sistema CFTV.
MEZ-CHESF-SE-OLINDINA: Montagem de Painéis de Telecomunicações.
Entre outros...
✍ Se o usuário quiser mais detalhes, o chatbot pode sugerir acessar a aba 'Portfólio' no site ou entrar em contato.

📌 Geração de Perguntas Dinâmicas
🚀 Regras

O ExaBot sempre sugere 3 perguntas relacionadas ao contexto da conversa.
Formato obrigatório de resposta (JSON puro):
json
Copiar
Editar

Importante:
        - Sempre responda dentro do escopo da **EXA Engenharia**.
        - Destaque informações importantes em **negrito**, como **serviços, clientes importantes, telefone, e-mail e endereço**.
        - Gere sempre **3 perguntas dinâmicas**, exceto se a pergunta não tiver relação com a empresa.
        - Se a pergunta for irrelevante, responda com: "Desculpe, só posso responder perguntas sobre a **EXA Engenharia**."
        
        🔹 **Formato da resposta (JSON puro, sem explicações ou marcações de código):**
        {
            "resposta": "Texto da resposta principal do ExaBot",
            "perguntasDinamicas": ["Pergunta 1", "Pergunta 2", "Pergunta 3"]
        }
NÃO inclua nada fora do JSON.

Se não houver perguntas relevantes, ele gera perguntas genéricas úteis.
Exemplos de perguntas corretas:
✅ "Quais são os serviços oferecidos pela EXA Engenharia?"
✅ "Como posso solicitar um orçamento?"
✅ "A EXA oferece suporte técnico?"
❌ Regras importantes para evitar erros:

📌 Ajustes Futuros e Melhorias
🔹 Passo 3: Destacar Informações Importantes

Tudo que for serviço, clientes importantes, contatos, e qualquer nome relevante será destacado em negrito.
🔹 Passo 4: Melhorando o Feedback do Chatbot

O chatbot sempre avisará que o usuário pode clicar nas perguntas sugeridas ou digitar sua dúvida.
Exemplo de frase adicionada dinamicamente após uma resposta deixando em negrito as partes mais importantes para o usuário:
"Caso queira mais informações, você pode clicar em uma das perguntas no balão ou digitar sua dúvida. Estou à disposição para ajudar!"
🔹 Passo 5: Direcionamento para o Contato

Sempre que a conversa estiver chegando ao fim, o ExaBot sugerirá o contato com a EXA Engenharia, garantindo um fluxo profissional e conversão de clientes.
`;

// 🔹 Função para detectar o idioma usando OpenAI
async function detectarIdioma(mensagem) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: "Detecte o idioma da seguinte mensagem e retorne apenas o nome do idioma, sem explicações extras." },
                    { role: 'user', content: mensagem }
                ],
                max_tokens: 10,
                temperature: 0
            })
        });

        if (!response.ok) {
            console.error("❌ Erro ao detectar idioma.");
            return "Português"; // Se falhar, assume português
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content.trim() || "Português"; // Retorna o idioma detectado ou assume "Português"

    } catch (error) {
        console.error("❌ Erro ao detectar idioma:", error);
        return "Português"; // Se falhar, assume português
    }
}


function organizarTopicos(resposta) {
    let intro = "";
    let itens = [];
    let fraseFinal = "";

    const linhas = resposta.split("\n").map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];

        // Primeira linha que não começa com marcador é a introdução
        if (!intro && !linha.startsWith("-") && !linha.startsWith("•")) {
            intro = linha;
            continue;
        }

        // Junta frases finais que vieram quebradas (ex: "Digite..." + "e eu explico...")
        if (
            linha.toLowerCase().startsWith("caso") ||
            linha.toLowerCase().startsWith("digite") ||
            linha.toLowerCase().startsWith("estou") ||
            linha.toLowerCase().startsWith("se precisar") ||
            linha.toLowerCase().includes("balão") ||
            linha.includes("😀") ||
            linha.length > 10 && !linha.startsWith("-") && !linha.startsWith("•")
        ) {
            fraseFinal += (fraseFinal ? " " : "") + linha;
            continue;
        }

        // Remove duplicação de marcador e adiciona como item
        const item = linha.replace(/^[-•\s]+/, "").trim();
        if (item) itens.push(item);
    }

    const itensFormatados = itens.map(item => `• ${item}`).join("\n");

    let respostaFinal = intro;
    if (itens.length > 0) {
        respostaFinal += `\n\n${itensFormatados}`;
    }
    if (fraseFinal.trim()) {
        respostaFinal += `\n\n${fraseFinal.trim()}`;
    }

    return respostaFinal;
}



// 🔹 Faz a requisição para a OpenAI
const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: prompt },
            { 
                role: 'user', 
                content: mensagem

              }              
        ],
        max_tokens: 400,
        temperature: 0.7
    })
});

if (!resposta.ok) {
    console.error("❌ Erro na requisição da OpenAI para gerar resposta.");
    return res.status(500).json({ error: 'Erro ao processar a solicitação.' });
}

const data = await resposta.json();

try {
    console.log("🔹 Resposta bruta da OpenAI:", data.choices[0].message.content);

    let responseText = data.choices[0].message.content.trim();
    let respostaFinal = responseText;

    // Verifica se a resposta está no formato JSON válido
    if (responseText.startsWith('{') && responseText.endsWith('}')) {
        const responseJson = JSON.parse(responseText);

        let perguntasDinamicas = responseJson.perguntasDinamicas || [];

        const respostasInvalidas = [
            "não sei", "não posso responder", "não encontrei informações",
            "essa pergunta foge do escopo", "não tenho essa informação",
            "consulte um especialista", "não possuo dados sobre isso"
        ];

        perguntasDinamicas = perguntasDinamicas.filter(pergunta =>
            !respostasInvalidas.some(frase => pergunta.toLowerCase().includes(frase))
        );

        perguntasDinamicas = [...new Set(perguntasDinamicas)];

        const palavrasDespedida = ["Até mais", "Até logo", "orçamento", "8h às 17h", "podemos ajudar mais tarde"];
        respostaFinal = responseJson.resposta || "Desculpe, só posso responder perguntas sobre a EXA Engenharia.";

        let gerarPerguntas = !palavrasDespedida.some(palavra => respostaFinal.toLowerCase().includes(palavra));

        if (gerarPerguntas && perguntasDinamicas.length === 0 && responseJson.resposta) {
            const novaPergunta = await gerarPerguntasAutomaticas(responseJson.resposta);
            if (novaPergunta.length > 0) {
                perguntasDinamicas = novaPergunta;
            }
        }

        if (!respostaFinal || respostaFinal.includes("Desculpe")) {
            respostaFinal = `
            Caso precise, você pode entrar em contato com a EXA Engenharia pelo  


            📞 **Telefone:** (81) 99996-5585  
            ✉️ **E-mail:** contato@exaengenharia.com  
            `;
            perguntasDinamicas = [
                "Quais serviços a EXA oferece?",
                "Qual seria o portfólio da EXA?",
                "Como faço para contratar um serviço?"
            ];
        }

       // 🔹 Organiza tópicos antes de retornar ao usuário
const respostaComTopicos = organizarTopicos(responseJson.resposta || "Desculpe, só posso responder perguntas sobre a EXA Engenharia.");


// 🔹 Reforça negrito nos itens importantes mesmo se vierem com vírgula
let respostaFinalFormatada = respostaComTopicos
    .replace(/(?<!\*)\b(Cabeamento Estruturado)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Painéis de Telecomunicações)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(CFTV)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Fibra Óptica)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Implantação de Sistemas)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Teleproteção Digital)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Automação)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Teleproteção Oplat)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Especificação Técnica)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(WorkStatement)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Projeto Básico e Executivo)\b(?!\*)/gi, '**$1**')
    .replace(/(?<!\*)\b(Medição de Resistividade do Solo)\b(?!\*)/gi, '**$1**');


    const respostaParaRetorno = {
        resposta: respostaFinalFormatada,
        perguntasDinamicas: perguntasDinamicas.length > 0 ? perguntasDinamicas : []
    };    


        let sugestaoDigitar = "";
        if (gerarPerguntas && perguntasDinamicas.length > 0) {
            sugestaoDigitar = "Caso tenha uma dúvida mais específica, digite abaixo ou clique em uma das opções acima. 📌";
        }

        // Salva a resposta do bot no histórico
        if (modoOrcamento && respostaFinal) {
            dadosUsuarios.historico.push({ role: 'assistant', content: respostaFinal });
        }

        // ✅ Organiza os tópicos se não estiverem organizados ainda
respostaParaRetorno.resposta = organizarTopicos(respostaParaRetorno.resposta);

// ✅ Retorna a resposta com sugestão
return res.json({
    ...respostaParaRetorno,
    sugestaoDigitar
});

    } else {
        console.warn("⚠️ Resposta inesperada da OpenAI, retornando fallback.");
        return res.json({
            resposta: responseText,
            perguntasDinamicas: []
        });
    }
} catch (error) {
    console.error("❌ Erro ao processar JSON da OpenAI:", error);
    return res.json({
        resposta: data.choices ? data.choices[0].message.content : "Erro ao processar a resposta.",
        perguntasDinamicas: []
    });
}


} catch (error) {
console.error('Erro no servidor:', error);
return res.status(500).json({ error: 'Erro ao processar a solicitação.' });
}
});

/*************************************************************** 
 *        🔹 Função para gerar perguntas automaticamente
 ***************************************************************/
async function gerarPerguntasAutomaticas(resposta) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { 
                        role: 'system', 
                        content: `Você é o **ExaBot**, assistente virtual da **EXA Engenharia**.  
                        Sua função é gerar perguntas relevantes **apenas sobre os serviços da EXA**.
                        
                        **Regras para perguntas:**
                        1️⃣ As perguntas devem estar **100% relacionadas à EXA Engenharia**.
                        2️⃣ Perguntas devem ajudar o usuário a entender melhor os serviços da empresa.
                        3️⃣ Nunca gere perguntas genéricas ou que a EXA não saiba responder.
                        
                        **Lista de serviços da EXA para referência:**
                        - Cabeamento Estruturado
                        - Painéis de Telecomunicações
                        - CFTV
                        - Fibra Óptica
                        - Implantação de Sistemas
                        - Teleproteção Digital
                        - Automação
                        - Teleproteção Oplat
                        - Especificação Técnica
                        - WorkStatement
                        - Projeto Básico e Executivo
                        - Medição de Resistividade do Solo
                        
                        **Formato da resposta (JSON puro):**
                        {
                            "perguntasDinamicas": ["Pergunta 1", "Pergunta 2", "Pergunta 3"]
                        }
                        `
                    },
                    { role: 'user', content: `Baseado na seguinte resposta sobre a EXA Engenharia, gere três perguntas relevantes: ${resposta}` }
                ],
                max_tokens: 100,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (response.ok && data.choices) {
            let responseText = data.choices[0].message.content.trim();
            
            if (responseText.startsWith('{') && responseText.endsWith('}')) {
                const responseJson = JSON.parse(responseText);
                
                // 🔹 Garante que as perguntas sejam válidas
                return responseJson.perguntasDinamicas.filter(pergunta =>
                    pergunta.includes("EXA") || pergunta.includes("engenharia") || pergunta.includes("serviço") || pergunta.includes("técnico")
                ) || [];
            }
        }

        return []; // Se não conseguir gerar perguntas, retorna um array vazio
    } catch (error) {
        console.error("❌ Erro ao gerar perguntas dinâmicas:", error);
        return [];
    }
}


// 🔹 Rota de teste para verificar se o servidor está rodando
app.get('/', (req, res) => {
    res.send('Bem-vindo ao Assistente Virtual da Exa Engenharia!');
});

// 🔹 Rota de ping para verificar se o servidor está ativo
app.get('/ping', (req, res) => {
    console.log('Servidor foi acionado pelo ping do frontend!');
    res.status(200).send('Servidor ativo!');
});

// 🔹 Inicia o servidor na porta 3000
app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}.`);
});


