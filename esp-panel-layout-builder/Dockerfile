ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.19
FROM ${BUILD_FROM}

WORKDIR /opt/esp-panel-layout-builder

RUN apk add --no-cache nodejs npm

COPY app/package.json /opt/esp-panel-layout-builder/app/package.json

RUN cd /opt/esp-panel-layout-builder/app \
    && npm install \
    && npm cache clean --force

COPY app /opt/esp-panel-layout-builder/app
COPY run.sh /opt/esp-panel-layout-builder/run.sh

RUN chmod a+x /opt/esp-panel-layout-builder/run.sh \
    && cd /opt/esp-panel-layout-builder/app \
    && npm run build \
    && npm prune --omit=dev

EXPOSE 8099

CMD ["/opt/esp-panel-layout-builder/run.sh"]
