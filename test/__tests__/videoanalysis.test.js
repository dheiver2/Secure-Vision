'use-strict';

import fs from 'fs';
import path from 'path';
import Database from '../../src/api/database.js';
import VideoAnalysisService from '../../src/controller/camera/services/videoanalysis.service.js';

// Prepare database and camera settings reais
beforeAll(async () => {
  const database = new Database();
  await database.prepareDatabase();
  await Database.resetDatabase();
  await database.prepareDatabase();

  const camSettings = {
    name: 'TestCam',
    rekognition: {
      active: true,
      confidence: 80,
      labels: ['person'],
    },
    videoanalysis: {
      active: false,
    },
    videoConfig: {
      source: '',
    },
  };

  const settings = Database.interfaceDB.chain.get('settings').get('cameras');
  settings.push(camSettings).value();
  await Database.interfaceDB.write();
});

describe('Detecção real com COCO-SSD', () => {
  it('executa detecção com modelo real em imagem existente', async () => {
    const imgPath = path.resolve(process.cwd(), 'images', 'browser', 'camera.png');
    const imgBuffer = await fs.promises.readFile(imgPath);

    const service = new VideoAnalysisService(
      { name: 'TestCam', prebuffering: false, videoConfig: { source: '' } },
      null,
      { codecs: { ffmpegVersion: '4.2' } },
      null
    );

    // Usa o modelo real e a imagem real
    const result = await service.runObjectDetectionFromBuffer(imgBuffer);

    // Deve retornar array e não lançar erros
    expect(Array.isArray(result)).toBe(true);

    // Se houver detecções, caixas devem estar normalizadas [0..1]
    for (const det of result) {
      for (const box of det.boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.width).toBeGreaterThanOrEqual(0);
        expect(box.height).toBeGreaterThanOrEqual(0);
        expect(box.left).toBeLessThanOrEqual(1);
        expect(box.top).toBeLessThanOrEqual(1);
        expect(box.width).toBeLessThanOrEqual(1);
        expect(box.height).toBeLessThanOrEqual(1);
      }
    }
  });
});