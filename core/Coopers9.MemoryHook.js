/**
 * Coopers9.MemoryHook v1.0.0.0
 * Auteur : SamRevolt
 * Module d'intégration Edge.js pour accéder à la DLL C# permettant l'extraction des offsets mémoire du jeu Cooper9.
 * Ce module expose deux interfaces :
 *   - style callback : module.exports(cb) => cb({ BaseAddress, PlayerOffsets, CreditsOffset })
 *   - style promesse : module.exports.promise() => Promise<{ BaseAddress, PlayerOffsets, CreditsOffset }>
 * Utilise la méthode Finder.GetModuleBaseAddressAndOffsets côté C#.
 */

const edge = require('edge-js');
const path = require('path');

const dllPath = path.join(__dirname, 'lib', 'Coopers9.MemoryHook.dll');

// Méthode retournant la structure complète
const getBaseAddressAndOffsets = edge.func({
  assemblyFile: dllPath,
  typeName: 'Coopers9.Finder', 
  methodName: 'GetModuleBaseAddressAndOffsets'
});

/**
 * Callback style
 * Retourne un objet : { BaseAddress, PlayerOffsets, CreditsOffset }
 */
module.exports = function(cb) {
  getBaseAddressAndOffsets(null, (err, result) => {
    if (err) return cb(err);
    cb(null, {
      BaseAddress: Number(result.BaseAddress),
      PlayerOffsets: result.PlayerOffsets,
      CreditsOffset: Number(result.CreditsOffset)
    });
  });
};

/**
 * Promesse style
 * Retourne un objet : { BaseAddress, PlayerOffsets, CreditsOffset }
 */
module.exports.promise = () => {
  return new Promise((resolve, reject) => {
    getBaseAddressAndOffsets(null, (err, result) => {
      if (err) return reject(err);
      resolve({
        BaseAddress: Number(result.BaseAddress),
        PlayerOffsets: result.PlayerOffsets,
        CreditsOffset: Number(result.CreditsOffset)
      });
    });
  });
};