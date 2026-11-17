
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Diplomes {

    struct Diplome {
        bytes32 hash;
        string nom;
        uint256 date;
        bool valide;
        bool existe;
    }

    address public owner;

    mapping(bytes32 => Diplome) private diplomes;

    event DiplomeEmis(bytes32 indexed hash, string nom, uint256 date);
    event DiplomeRevoque(bytes32 indexed hash);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Acces refuse");
        _;
    }

    function emettreDiplome(
        bytes32 _hash,
        string memory _nom
    ) public onlyOwner {
        require(_hash != bytes32(0), "Hash invalide");
        require(bytes(_nom).length > 0, "Nom vide");
        require(!diplomes[_hash].existe, "Diplome deja enregistre");

        diplomes[_hash] = Diplome({
            hash: _hash,
            nom: _nom,
            date: block.timestamp,
            valide: true,
            existe: true
        });

        emit DiplomeEmis(_hash, _nom, block.timestamp);
    }

    function verifierDiplome(bytes32 _hash)
        public
        view
        returns (bool existe, bool valide, string memory nom, uint256 date)
    {
        Diplome memory d = diplomes[_hash];

        return (d.existe, d.valide, d.nom, d.date);
    }

    function revoquerDiplome(bytes32 _hash) public onlyOwner {
        require(diplomes[_hash].existe, "Diplome introuvable");
        require(diplomes[_hash].valide, "Diplome deja revoque");

        diplomes[_hash].valide = false;

        emit DiplomeRevoque(_hash);
    }
}
