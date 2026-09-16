-- msg_tipo ganha 'video' e 'arquivo'.
--
-- Vídeo de canteiro e planilha/Word mandados no grupo chegavam como `texto`
-- (o mapeador só conhecia texto/imagem/pdf/audio) e o arquivo, embora baixado,
-- nunca virava documento. Com os dois valores o tipo da mensagem diz a verdade
-- e o arquivamento passa a aceitar qualquer arquivo (menos executável).
--
-- Regra da casa: ADD VALUE não pode ser usado na mesma transação em que é
-- criado — esta migration só acrescenta; quem usa é o código.

ALTER TYPE public.msg_tipo ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE public.msg_tipo ADD VALUE IF NOT EXISTS 'arquivo';
