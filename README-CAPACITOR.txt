RESTX — CAPACITOR / ANDROID + IPHONE

IMPORTANTE:
Este ZIP NAO e um APK nem um IPA pronto. Ele e o PROJETO-FONTE nativo.
Apenas descompactar e abrir o index.html continua sendo a versao web/PWA
e NAO ativa as notificacoes nativas do Capacitor.

PARA TESTAR NO ANDROID (Windows):
1. Instale Node.js.
2. Instale Android Studio e o Android SDK.
3. Descompacte este ZIP.
4. Abra PowerShell dentro da pasta RestX-Capacitor.
5. Execute:
       Set-ExecutionPolicy -Scope Process Bypass
       .\1-INSTALAR-ANDROID.ps1
6. O script instala as dependencias, cria o projeto Android, copia o som
   nativo e sincroniza o Capacitor.
7. O Android Studio sera aberto.
8. Conecte o Android por USB com Depuracao USB habilitada ou use um emulador.
9. Pressione Run no Android Studio para instalar o RestX como aplicativo.

TESTE:
- Abra o RestX instalado pelo Android Studio.
- Escolha 30s.
- Toque em Iniciar.
- Aceite a permissao de notificacoes quando solicitada.
- Saia do aplicativo e espere 30 segundos.
- O Android deve emitir a notificacao local agendada.
- O som depende do volume, modo silencioso/nao perturbe e configuracao
  do canal de notificacao do aparelho.

ATUALIZAR DEPOIS DE ALTERAR O CODIGO:
       .\2-ATUALIZAR-ANDROID.ps1

IPHONE:
A plataforma iOS precisa ser adicionada/compilada em macOS com Xcode.
Em um Mac:
       npm install
       npm run cap:add:ios
       npm run cap:ios

POR QUE O TESTE ANTERIOR NAO FUNCIONOU:
Se o arquivo foi apenas descompactado e aberto no navegador/celular,
o Capacitor nao estava executando como aplicativo nativo. Nesse caso,
o RestX continuava sendo PWA e sofria exatamente a limitacao de segundo
plano que estamos tentando eliminar.

A INTERFACE DO RESTX FOI MANTIDA. A mudanca principal e o agendamento
nativo da notificacao no Android/iOS.
